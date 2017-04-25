import SupportingActor from './SupportingActor';
import CONSTANTS from '../util/constants'

/**
 * Class representing a background support actor
 * @extends SupportingActor
 * @singleton
 */
class BgMusicSupportingActor extends SupportingActor {
    /**
     * Creates a background support actor.
     *
     * @param {object} sActor - config data from backgroundMusic
     */
    constructor (sActor) {
        let volumeLevel = sActor.volumeLevel;
        super(sActor);

        this.type = CONSTANTS.actor.type.SUPPORT;
        this.enterStage = sActor ? sActor.enterStage : null;
        this.exitStage = sActor ? sActor.exitStage : null;
        this.fadingSilence = sActor ? sActor.fadingSilence : null;

        this.registerTrack({
            volume: (volumeLevel >= 0 && volumeLevel <= 1) ? volumeLevel : CONSTANTS.webPlayer.DEFAULT_BG_VOLUME_LEVEL_AS_PCT
            , loop: true
        });
    }
}

export default BgMusicSupportingActor;
