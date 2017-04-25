import WebPlayerActions from '../actions/WebPlayerActions';
import merge from 'merge';
import CONSTANTS from '../util/constants';

/* cross-browser audio library */
require('howler');

/**
 *  Base class representing a SupportingActor.
 *
 *  for supplemental assets like:
 *      - image actors: speech tracks (audio map), bgMusic, visualFx (image transition libs, etc..)
 *      - video actors: n/a
 */
class SupportingActor {
    /**
     * Creates a supporting actor.
     *
     * @param {object} sActor - config section from audioMap or backgroundMusic
     */
    constructor (sActor) {
        this.type = null;
        this.src = sActor ? sActor.fileName : null;
        this.hId = null;
        this.howlHandler = null;
        this.fadeOptions = null;
        this.alreadyFaded = false;
    }

    /**
     * Listen for specific howl events to manipulate audio playback.
     */
    bindListeners () {
        this.howlHandler.on('pause', (id) => {
            WebPlayerActions.doDelaySpeechTrack(false);
        });
    }

    /**
     * Set unique id for audio instance.
     *
     * @param {number} id - unique id
     */
    setHowlId (id) {
        if (typeof id === "number") {
            this.hId = id;
        } else {
            console.error(CONSTANTS.errors.ID_NOT_NUMERIC);
        }
    }

    /**
     * Get audio instance id.
     */
    getHowlId () {
        return this.hId;
    }

    /**
     * Play audio instance.
     */
    play () {
        this.hId = typeof this.hId === "number" ? this.howlHandler.play(this.hId) : this.howlHandler.play();

        /* only fade upon initial start of audio - not after un-pausing it */
        if (!this.alreadyFaded && this.fadeOptions && typeof this.fadeOptions === "object") {
            this.alreadyFaded = true;
            this.howlHandler.fade(this.fadeOptions.from, this.fadeOptions.to, this.fadeOptions.duration, this.hId);
        }
    }

    /**
     * Pause audio (and save seek position).
     */
    pause () {
        this.howlHandler.pause(this.hId);
    }

    /**
     * Stop audio (and reset seek position).
     */
    stop() {
        this.howlHandler.stop(this.hId);
    }

    /**
     * Creates a Howl instance with audio data.
     *
     * @param {object} options - Howl configuration options
     */
    registerTrack (options) {
        this.unloadTrack();
        this.howlHandler = new Howl(merge(typeof options === "object" ? options : {}, {
            src: this.src
        }));

        this.bindListeners();
    }

    /**
     * Unloads audio instance from memory.
     */
    unloadTrack () {
        if (this.howlHandler) {
            this.howlHandler.unload();
        }
    }

    /**
     * Returns Howl instance.
     *
     * @returns {Howl|null}
     */
    getHowlInstance () {
        return this.howlHandler;
    }

    /**
     * Sets audio fade-in options.
     *
     * @param {object} options - Howl fade-in configuration options
     */
    setFade (options) {
        if (!options || typeof options !== "object") {
            return;
        }
        this.fadeOptions = options;
    }
}

export default SupportingActor;
