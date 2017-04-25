import Actor from './Actor';
import CONSTANTS from '../util/constants'

/**
 * Class representing a video actor.
 */
class VideoActor extends Actor {
    /**
     * Creates a video actor.
     * @param {object} actor - config data from the ActorMap
     */
    constructor (actor) {
        super(actor);
        this.type = CONSTANTS.actor.type.VIDEO;
        this.src = actor ? actor.src : null;

        if (actor === null || typeof actor !== "object") {
            throw new Error(CONSTANTS.actor.error.INVALID_OR_NO_ACTOR);
        }
    }
}

export default VideoActor;
