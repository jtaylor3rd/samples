import alt from '../util/altHandler';
import WebPlayerActions from '../actions/WebPlayerActions'
import CONSTANTS from '../util/constants'
import emitter from '../util/emitter';
import ImageActor from '../classes/ImageActor';
import VideoActor from '../classes/VideoActor';
import BlankActor from '../classes/BlankActor';
import AudioSupportingActor from '../classes/AudioSupportingActor';
import BgMusicSupportingActor from '../classes/BgMusicSupportingActor';
import merge from 'merge';
import Common from '../util/common';

let playLoopIntervalId
    , speechLoopIntervalId
    , actorPlayerInterval
    , speechLoopInterval
    , onlyRunOnce = true
    , playTimeStart
    , playTimeEnd;

/**
 * Web Player Store Class
 */
export class WebPlayerStoreInstance {
    constructor() {
        this.state = {
            webPlayer: {
                doDelay: true
                , width: undefined
                , height: undefined
                , isPlaying: false
                , activeActorId: undefined
                , activeSActorId: undefined
                , baseImagePath: CONSTANTS.paths.BASE_IMAGE_PATH
                , bgVolumeLevel: CONSTANTS.webPlayer.DEFAULT_BG_VOLUME_LEVEL_AS_PCT
                , actorFadeInTimeout: CONSTANTS.webPlayer.DEFAULT_FADE_IN_TIMEOUT_IN_MS
                , actorFadeOutTimeout: CONSTANTS.webPlayer.DEFAULT_FADE_OUT_TIMEOUT_IN_MS
                , playAudio: false
                , actors: []
                , audio: []
                , bgMusic: {} /* singleton */
                , leader: null
                , name: null
                , bgPlayerEl: null
            }
        };
        this.bindActions(WebPlayerActions);
    }

    /**
     * Instantiates all sections of config object into Actor instances
     *
     * - actors => state.webPlayer.actors
     * - speech => state.webPlayer.audio
     * - bgMusic => state.webPlayer.bgMusic
     * - apply overrides (bg volume, image base path)
     * @param {object} config - Mutated client config passed into render()
     */
    parseConfig (config) {
        let _generateActors
            , _generateBgMusic
            , _generateAudio

            /* remove trailing slash */
            , overridenActorImageBasePath = config && config.overrides && config.overrides.actorImageBasePath &&
                typeof config.overrides.actorImageBasePath === "string" ? config.overrides.actorImageBasePath.replace(/\/$/, '') : null
            , overridenBgVolumeLevel = config && config.overrides ? config.overrides.bgVolumeLevel : null
            , changes = merge({}, this.state);

        /**
         * Creates Actor instances.
         * @private
         */
        _generateActors = () => {
            let actorMapData = config.actorMap
                , changes = merge({}, this.state)
                , actors = changes.webPlayer.actors
                , key
                , curActor
                , actorType;

            for (key in actorMapData) {
                curActor = actorMapData[key];

                /* determine actor type */
                actorType = curActor ? curActor.hasOwnProperty(CONSTANTS.actor.type.IMAGE_TYPE_KEY) ? CONSTANTS.actor.type.IMAGE : CONSTANTS.actor.type.VIDEO : null;

                /* depending on type, push new instance of ImageActor or VideoActor */
                switch (actorType) {
                    case CONSTANTS.actor.type.VIDEO:
                        actors.push(new VideoActor(curActor));
                        break;
                    case CONSTANTS.actor.type.IMAGE:
                        actors.push(new ImageActor(curActor, this.state.webPlayer.baseImagePath));
                        break;
                }
            }

            /* push a blank asset to fade out the last actor before resetting player */
            actors.push(new BlankActor());
            this.setState(changes);
        };

        /**
         * Creates Supporting Actor (speech audio) instances.
         * @private
         */
        _generateAudio = () => {
            let audioMap = config.audioMap
                , curAudioSupportingActor
                , key
                , changes = merge({}, this.state);

            for (key in audioMap) {
                curAudioSupportingActor = audioMap[key];
                changes.webPlayer.audio.push(new AudioSupportingActor(curAudioSupportingActor));
            }
            this.setState(changes);
        };

        /**
         * Creates a singleton Supporting Actor (background audio) instance.
         * @private
         */
        _generateBgMusic = () => {
            let changes = merge({}, this.state)
                , volumeLevel = (1 * this.state.webPlayer.bgVolumeLevel) / 100

                /* essentially adding a new config property to keep within the standard
                 * of passing a single config object to Actor Class constructors */
                , augmentedBgMusicConfig = merge(config.backgroundMusic, {
                    volumeLevel: volumeLevel
                });

            changes.webPlayer.bgMusic = new BgMusicSupportingActor(augmentedBgMusicConfig);
            this.setState(changes);
        };

        try {
            if (!config) {
                throw Error(CONSTANTS.errors.NO_CONFIG);
            }

            /* apply overrides if applicable */
            if (overridenActorImageBasePath) {
                this.setBaseImagePath(overridenActorImageBasePath);
            }

            if (overridenBgVolumeLevel) {
                this.setBgVolumeLevel(overridenBgVolumeLevel);
            }

            changes.webPlayer.name = config.name;
            changes.webPlayer.leader = config.leader;

            _generateActors();
            _generateAudio();
            _generateBgMusic();
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Sets the base image path for imgix requests.
     *
     * @param {string} actorImageBasePath - The path to use for image actor
     * asset requests
     */
    setBaseImagePath (actorImageBasePath) {
        let changes = merge({}, this.state);

        changes.webPlayer.baseImagePath = actorImageBasePath;
        this.setState(changes);
    }

    /**
     * Set the background audio level.
     *
     * @param {number} volumeLevelAsPct - The level as a percent
     */
    setBgVolumeLevel (volumeLevelAsPct) {
        let changes = merge({}, this.state);

        changes.webPlayer.bgVolumeLevel = volumeLevelAsPct;
        this.setState(changes);
    }

    /**
     * Set active Actor.
     *
     * @param {number} id - Actor id
     */
    setActiveActor (id) {
        this.state.webPlayer.activeActorId = +id;
    }

    /**
     * Set the state of the player
     *
     * @param {boolean} state - Marks the player to be played or paused
     */
    setPlayerState (state) {
        let changes = merge({}, this.state);

        changes.webPlayer.isPlaying = (state && typeof state === "boolean") ? state : false;
        changes.webPlayer.finishedPlayback = false;

        this.setState(changes);
    }

    /**
     * Starts web player.
     *
     * If no override param has been passed (more on that shortly..) increment
     * the active actor id, which upon next render() cycle, forces a new image
     * to be loaded onto the stage.
     *
     * The main idea of this method is to set up an interval to run this very
     * method repeatedly, until all Actors have been processed. For each Actor
     * we calculate an interval (exitStage - enterStage) plus some padding to
     * account for the cross-fade between images - as one Actor leaves the
     * stage and another one enters.
     *
     * We keep track of the play time (in case of pauses) in order to correctly
     * resume image playback.
     *
     * The [intervalOverrideInMillis] parameter is used to adjust the interval
     * - essentially shortening the amount of play time left for the current
     * Actor.
     *
     * Finally, the last interval is setup to invoke resetPlayer() which will
     * allow us to resume playback from the first Actor.
     *
     * @param {number} intervalOverrideInMillis - Number of milliseconds that
     * has passed since the last pause
     */
    startWebPlayer (intervalOverrideInMillis) {
        let activeActorId
            , actors
            , activeActor
            , interval
            , targetFn = this.startWebPlayer.bind(this);

        /* we only pass an override to play the remaining time for an actor asset
         * therefore we do not want to load the next actor yet. */
        if (typeof intervalOverrideInMillis !== "number") {
            this.incrementActiveActorId();
        }

        activeActorId = this.state.webPlayer.activeActorId;
        actors = this.state.webPlayer.actors;
        activeActor = actors[activeActorId];

        if (typeof intervalOverrideInMillis !== "number") {
            playTimeStart = Date.now();
            actorPlayerInterval = activeActor.exitStage - activeActor.enterStage;
            interval = (activeActor.exitStage - activeActor.enterStage) + CONSTANTS.actor.INTERVAL_BUFFER_IN_MS;
        } else {
            interval = actorPlayerInterval - intervalOverrideInMillis;
            actorPlayerInterval = interval;
            interval += CONSTANTS.actor.INTERVAL_BUFFER_IN_MS;
        }

        if (onlyRunOnce && activeActor.type === "image") {
            onlyRunOnce = false;
            this.loadSupportAssets();
        }

        /* clear the last interval set since we are going to define a new one */
        if (playLoopIntervalId) {
            clearInterval(playLoopIntervalId);
        }

        playLoopIntervalId = setInterval(() => {
            targetFn();
        }, interval);

        /* stop looping if we have reached the last actor */
        if (activeActorId >= actors.length-1) {
            targetFn = this.resetPlayer.bind(this);
        }
    }

    /**
     * Resets web player.
     */
    resetPlayer () {
        let changes = merge({}, this.state);

        onlyRunOnce = true;
        playTimeStart = undefined;
        playTimeEnd = undefined;

        this.stopBgMusic();
        this.stopSpeechTrack();

        changes.webPlayer.finishedPlayback = true;
        changes.webPlayer.isPlaying = false;
        changes.webPlayer.activeActorId = undefined;
        changes.webPlayer.activeSActorId = undefined;
        changes.webPlayer.speechTrackEl = null;

        clearInterval(playLoopIntervalId);
        this.setState(changes);
    }

    /**
     * Load supporting assets for actor types.
     *
     *  - videos: n/a
     *  - images: speech, bgMusic, visualFx (that are not done with css3 animations)
     */
    loadSupportAssets () {
        let webPlayer;

        webPlayer = this.state.webPlayer;

        if (webPlayer.bgMusic && webPlayer.bgMusic.howlHandler) {
            this.playBgMusic();
        }
        this.initSpeechLoop();
    }

    /**
     * Starts speech track loop.
     *
     * Similar to startWebPlayer(), this method increments the active speech actor
     * id, as well as inserts delays only when audio tracks are first played.
     *
     * The main idea of this method is to set up an interval to run this very
     * method repeatedly, until all Supporting Speech Actors have been processed.
     * For each Supporting Speech Actor
     * we calculate an interval (exitStage - enterStage) plus some padding to
     * account for the cross-fade between images - as one Actor leaves the
     * stage and another one enters. (This is done to keep in sync with the images)
     *
     * We keep track of the play time (in case of pauses) in order to correctly
     * resume speech playback.
     *
     * The [intervalOverrideInMillis] parameter is used to adjust the interval
     * - essentially shortening the amount of play time left for the current
     * Supporting Speech Actor.
     *
     * @param intervalOverrideInMillis
     */
    initSpeechLoop (intervalOverrideInMillis) {
        let webPlayer = this.state.webPlayer
            , activeSActorId
            , activeSActor
            , speechTracks
            , speechTrackHowlId
            , speechTracksLength
            , interval
            , changes = merge(this.state, {});

        /* we only pass an override to play the remaining time for an actor asset
         * therefore we do not want to load the next actor yet. */
        if (typeof intervalOverrideInMillis !== "number") {
            this.incrementActiveSpeechSActorId();

            /* since we only enter this block if we haven't paused playback
             * we will assume we are loading a new track, and thus want to
             * delay it */
            this.doDelaySpeechTrack(true);
        }

        speechTracks = webPlayer.audio;
        speechTracksLength = speechTracks.length;
        activeSActorId = webPlayer.activeSActorId;
        activeSActor = speechTracks[activeSActorId];
        speechTrackHowlId = activeSActor.getHowlId();

        if (webPlayer.audioPaused) {
            this.playSpeechTrack(speechTrackHowlId);
        } else {
            this.setState(changes);
            this.playSpeechTrack();
        }

        if (typeof intervalOverrideInMillis !== "number") {
            speechLoopInterval = activeSActor.exitStage - activeSActor.enterStage;
            interval = speechLoopInterval + CONSTANTS.actor.INTERVAL_BUFFER_IN_MS;
        } else {
            interval = speechLoopInterval - intervalOverrideInMillis;
            speechLoopInterval = interval;
            interval += CONSTANTS.actor.INTERVAL_BUFFER_IN_MS;
        }

        if (speechTracks && Array.isArray(speechTracks) && speechTracks.length > 0) {
            /* clear the last interval set since we are going to define a new one */
            if (speechLoopIntervalId) {
                clearInterval(speechLoopIntervalId);
            }

            speechLoopIntervalId = setInterval(() => {
                this.initSpeechLoop();
            }, interval);

            /* stop looping if we have reached the last actor */
            if (activeSActorId >= speechTracksLength-1) {
                clearInterval(speechLoopIntervalId);
            }
        }
    }

    /**
     * Marks a speech track to be delayed.
     *
     * @param {boolean} doDelay - Decides if speech audio should be delayed
     */
    doDelaySpeechTrack (doDelay) {
        let changes = merge({}, this.state);

        changes.webPlayer.doDelay = doDelay;
        this.setState(changes);
    }

    /**
     * Plays (or resumes from pause) a speech track.
     *
     * @param {number} id - Supporting Speech Actor id
     */
    playSpeechTrack (id) {
        let changes = merge({}, this.state)
            , webPlayer = changes.webPlayer
            , speechTracks = webPlayer.audio
            , activeSActorId = webPlayer.activeSActorId
            , activeSActor = speechTracks[activeSActorId]
            , _play;

        webPlayer.audioPaused = false;

        _play = () => {
            if (id) {
                activeSActor.play(id);
            } else {
                activeSActor.play();
                this.setState(changes);
            }
        };

        if (this.state.webPlayer.doDelay) {
            setTimeout(_play, CONSTANTS.webPlayer.DEFAULT_SPEECH_FADE_IN_MS);
        } else {
            _play();
        }
    }

    /**
     * Pauses speech track.
     */
    pauseSpeechTrack () {
        const webPlayer = this.state.webPlayer
            , speechTracks = webPlayer.audio
            , activeSActorId = webPlayer.activeSActorId
            , activeSActor = speechTracks[activeSActorId]
            , speechTrackId = activeSActor.getHowlId();

        let changes = merge(this.state, {});

        if (speechTrackId !== null) {
            changes.webPlayer.audioPaused = true;
            activeSActor.pause(speechTrackId);
            this.setState(changes);
        }
    }

    /**
     * Stops speech track.
     */
    stopSpeechTrack () {
        const webPlayer = this.state.webPlayer
            , speechTracks = webPlayer.audio
            , activeSActorId = webPlayer.activeSActorId
            , activeSActor = speechTracks[activeSActorId]
            , speechTrackId = activeSActor.getHowlId();

        let changes = merge(this.state, {});

        if (speechTrackId !== null) {
            changes.webPlayer.audioPaused = true;
            activeSActor.stop(speechTrackId);
            this.setState(changes);
        }
    }

    /**
     * Plays background track.
     */
    playBgMusic () {
        let changes = merge({}, this.state);

        changes.webPlayer.bgMusic.play();
        this.setState(changes);
    }

    /**
     * Pauses background track.
     */
    pauseBgMusic () {
        this.state.webPlayer.bgMusic.pause();
    }

    /**
     * Stops background track.
     */
    stopBgMusic () {
        this.state.webPlayer.bgMusic.stop();
    }

    /**
     * Increments (or defaults) the active actor id
     */
    incrementActiveActorId () {
        let val = (this.state.webPlayer.activeActorId >= 0) ? this.state.webPlayer.activeActorId+1 : 0
            , changes = merge({}, this.state);

        changes.webPlayer.activeActorId = val;
        this.setState(changes);
    }

    /**
     * Increments (or defaults) the active supporting speech actor id
     */
    incrementActiveSpeechSActorId () {
        let val = (this.state.webPlayer.activeSActorId >= 0) ? this.state.webPlayer.activeSActorId+1 : 0
            , changes = merge({}, this.state);

        changes.webPlayer.activeSActorId = val;
        this.setState(changes);
    }

    /**
     *
     * @param {number[]} args - The width and height of the main-stage-container
     */
    savePlayerDimensions (args) {
        let width = typeof args !== 'undefined' ? (Array.isArray(args) ? args[0] : args) : ''
            , height = typeof args !== 'undefined' ? (Array.isArray(args) ? args[1] : args) : ''
            , changes = merge({}, this.state);

        changes.webPlayer.width = width;
        changes.webPlayer.height = height;

        setTimeout(() => {
            this.setState(changes);
        }, 100);
    }

    /**
     * Toggles player state from "play" to "paused"
     *
     * If we are marked to not play, pause all audio (speech and background)
     * and record the elapsed time since last play.
     */
    togglePlayerState () {
        let webPlayer = this.state.webPlayer
            , changes = merge({}, this.state)
            , playTimeElpased
            , bgMusicHowlId = webPlayer.bgMusic.getHowlId()
            , activeSActorId = webPlayer.activeSActorId || 0
            , activeSActor = webPlayer.audio[activeSActorId]
            , speechTrackHowlId = activeSActor.getHowlId();

        changes.webPlayer.isPlaying = !webPlayer.isPlaying;

        if (changes.webPlayer.isPlaying) {
            changes.webPlayer.finishedPlayback = false;
            /* are we resuming from a paused state? */
            if (typeof playTimeStart !== "undefined" && typeof playTimeEnd !== "undefined") {
                playTimeElpased = playTimeEnd - playTimeStart;
                this.startWebPlayer(playTimeElpased);
                this.initSpeechLoop(playTimeElpased);

                /* start recording time elapsed */
                playTimeStart = Date.now();
            } else {
                this.startWebPlayer();
            }

            if (webPlayer.bgMusic && bgMusicHowlId !== null) {
                if (!webPlayer.bgMusic.getHowlInstance().playing(bgMusicHowlId)) {
                    this.playBgMusic();
                }
            } else if (webPlayer.bgMusic && bgMusicHowlId === null) {
                /* first play */
                this.playBgMusic();
            }
            playTimeEnd = undefined;
        } else {
            if (webPlayer.bgMusic && typeof bgMusicHowlId === "number") {
                if (webPlayer.bgMusic.getHowlInstance().playing(bgMusicHowlId)) {
                    this.pauseBgMusic();
                } else {
                    console.warn('not pausing bg music: webPlayer.bgMusic: ', webPlayer.bgMusic, '\tbgMusicHowlId: ', bgMusicHowlId, '\twebPlayer.bgMusic.getHowlInstance(): ', webPlayer.bgMusic.getHowlInstance()._sounds.length);
                }
            }

            if (webPlayer.audio && typeof speechTrackHowlId === "number") {
                if (activeSActor.getHowlInstance().playing(speechTrackHowlId)) {
                    this.pauseSpeechTrack();
                }
            }

            clearInterval(playLoopIntervalId);
            clearInterval(speechLoopIntervalId);

            /* paused - record stop time */
            playTimeEnd = Date.now();
        }

        this.setState(changes);
    }
}

/**
 * Allows deep-merging of state objects
 * @type {{setState: WebPlayerStoreInstance.config.setState}}
 */
WebPlayerStoreInstance.config = {
    setState: function (currentState, nextState) {
        if (Common.isMutableObject(nextState)) {
            return merge(currentState, nextState);
        } else {
            return nextState;
        }
    }
};

export default alt.createStore(WebPlayerStoreInstance, 'WebPlayerStore');
