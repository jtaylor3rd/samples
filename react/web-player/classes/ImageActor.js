import Actor from './Actor';
import CONSTANTS from '../util/constants'

/**
 * Class representing an image actor.
 * @extends Actor
 */
class ImageActor extends Actor {
    /**
     * Create an image actor.
     *
     * @param {object} actor - config data from ActorMap
     * @param {string} baseImagePath (Optional) - The client-specified
     * base path for images
     */
    constructor (actor, baseImagePath) {
        super(actor);
        this.type = CONSTANTS.actor.type.IMAGE;
        this.code = actor ? actor.code : null;
        this.src = (baseImagePath || CONSTANTS.paths.BASE_IMAGE_PATH) + "/" + this.code + ".jpg";

        if (actor === null || typeof actor !== "object") {
            throw new Error(CONSTANTS.actor.error.INVALID_OR_NO_ACTOR);
        }
    }
}

export default ImageActor;
