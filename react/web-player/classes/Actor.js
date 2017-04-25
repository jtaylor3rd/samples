let id = 0;

/**
 * Base class representing an Actor.
 */
class Actor {
    /**
     * Creates an actor.
     *
     * @param {object} actor - config section from ActorMap
     */
    constructor (actor) {
        this.id = id++;
        this.type = null;
        this.enterStage = actor ? actor.enterStage : null;
        this.exitStage = actor ? actor.exitStage : null;
    }
}

export default Actor;
