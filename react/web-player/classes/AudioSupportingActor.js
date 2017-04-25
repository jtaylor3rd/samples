import SupportingActor from './SupportingActor';
import CONSTANTS from '../util/constants'

/**
 * Audio Supporting Actor class
 * @extends SupportingActor
 */
class AudioSupportingActor extends SupportingActor {
    /**
     * Create an audio support actor
     *
     * @param {object} sActor - Config section from ActorMap
     */
    constructor (sActor) {
        super(sActor);

        this.type = CONSTANTS.actor.type.SUPPORT;
        this.enterStage = sActor ? sActor.enterStage : null;
        this.exitStage = sActor ? sActor.exitStage : null;

        this.registerTrack();
        this.setFade({
            from: 0
            , to: 1
            , duration: CONSTANTS.webPlayer.DEFAULT_SPEECH_FADE_IN_MS
        });
    }
}

export default AudioSupportingActor;
