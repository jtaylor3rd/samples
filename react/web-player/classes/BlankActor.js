import Actor from './Actor';
import CONSTANTS from '../util/constants'

/**
 * Class representing a stand-in actor.
 * @extends Actor
 *
 * Its purpose is to provide a smooth fade-out for the actor
 * image asset prior to it.
 */
class BlankActor extends Actor {
    /**
     * Creates a blank actor.
     */
    constructor () {
        super({
            type: null
            , enterStage: 0
            , exitStage: 100    // allows for full fade-out at end of set before loading the first actor
        });
        this.type = CONSTANTS.actor.type.IMAGE;
        this.code = null;
        this.src = "";
    }
}

export default BlankActor;
