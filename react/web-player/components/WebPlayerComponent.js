import React from 'react';
import WebPlayerActions from '../actions/WebPlayerActions';
import CONSTANTS from '../util/constants'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import merge from 'merge';
import debounce from 'javascript-debounce';

/**
 * Web Player Component Class
 *
 * This player is designed to read various types of data from a script (.scr)
 * configuration file, to extract the following assets:
 *  - actors (Image/video files)
 *  - supporting actors (speech audio, background music)
 *
 * The script will be parsed, and actor classes will be instantiated and stored
 * in the WebPlayerStore. It is here they will be fetched for playback
 */
class WebPlayerComponent extends React.Component {
    /**
     * Dispatch the action to parse the client config
     * (React Lifecycle method #1)
     */
    componentWillMount () {
        let config = this.props.config;
        WebPlayerActions.parseConfig(config);
    }

    /**
     * Get player dimensions.
     * (React Lifecycle method #2)
     *
     * Calculate the player dimensions to request the correct fx from
     * imgix. Then set up an event listener to perform this same
     * operation on window resize. This will case a new request to be
     * made to imgix.
     */
    componentDidMount () {
        let webPlayerEl = document.getElementById('main-stage-container')
            , width
            , height
            , fn = debounce(() => {
                width = webPlayerEl.clientWidth;
                height = webPlayerEl.clientHeight;
                WebPlayerActions.savePlayerDimensions(width, height);
            }, 200);

        if (webPlayerEl) {
            width = webPlayerEl.clientWidth;
            height = webPlayerEl.clientHeight;
            WebPlayerActions.savePlayerDimensions(width, height);
        }

        /* listen for resize events in order to reload images */
        window.addEventListener('resize', fn);
    }

    /**
     * Dynamically build animation styles for image actor assets.
     *
     * @param {object} activeActor - Currently loaded actor
     * @param {boolean} isPlaying - Tells if the web player is running
     * @param {boolean} isPaused - Tells if the web player is paused
     * @returns {object} - Map of CSS rules to interpolate into the
     * target JSX
     */
    buildCssStyles (activeActor, isPlaying, isPaused) {
        let durationInSeconds = (activeActor.exitStage - activeActor.enterStage) / 1000
            , kenBurnsAnimationExpr = "kenburns-top " + durationInSeconds + "s ease-out both"
            , ret = {}
            , tmp;

        if (isPlaying || !isPaused) {
            tmp = merge({
                animation: kenBurnsAnimationExpr
                , WebkitAnimation: kenBurnsAnimationExpr
                , MozAnimation: kenBurnsAnimationExpr
            }, ret);

            ret = tmp;
        }
        return ret;
    }

    /**
     * Returns the path of actor image/video files
     *
     * @param {object} activeActor - Currently loaded actor
     * @returns {string} - URL to the image/video file associated
     * with the actor asset
     */
    getImageSrc (activeActor) {
        return activeActor.src;
    }

    /**
     * Creates special url parameters to transform image assets from
     * imgix
     *
     * @returns {string} imgixProps - properties to append to all image
     * resource requests from imgix
     */
    getImgixProperties () {
        const webPlayer = this.props.webPlayerStore.webPlayer
            , width = webPlayer.width
            , height = webPlayer.height
            , imgixFxProps = "auto=enhance,redeyedpr=2.0&fit=crop&crop=faces&high=10&dpr=" + (window.devicePixelRatio || 1)
            , imgixProps = (width && height) ? "?w=" + width + ".0&h=" + height + ".0&" + imgixFxProps : "?" + imgixFxProps;

        return imgixProps;
    }

    /**
     * Dispatches an action to toggle the web player from play to paused
     */
    togglePlayerState () {
        WebPlayerActions.togglePlayerState();
    }

    /**
     * Displays the web player.
     *
     * On load, all class instances of actors and supporting actors are loaded, however
     * no images or videos are preloaded (except the 1st one for thumbnail view). All
     * audio however is loaded up front. This UI simply displays an image/video based on
     * the activeActorId, which will simply point to an existing Actor base class where
     * it can be loaded into the player by referencing its "src" member.
     *
     * The image source, css styles, and imgix properties are all fetched for the current
     * actor on the "stage". This allows each image to be rendered the same way.
     *
     * @returns {XML} 3-tiered heirarchy - control overlay, (image-overlay | video-overlay)
     */
    render () {
        console.warn('this: ', this.props);
        const webPlayer = this.props.webPlayerStore.webPlayer
            , actorFadeInTimeout = CONSTANTS.webPlayer.DEFAULT_FADE_IN_TIMEOUT_IN_MS
            , actorFadeOutTimeout = CONSTANTS.webPlayer.DEFAULT_FADE_OUT_TIMEOUT_IN_MS
            , activeActorId = webPlayer.activeActorId >= 0 ? +webPlayer.activeActorId : 0
            , actors = webPlayer.actors
            , activeActor = (actors && activeActorId >= 0) ? actors[activeActorId] : null
            , activeActorType = activeActor ? activeActor.type : null
            , speechTrackEl = webPlayer.speechTrackEl
            , isPlaying = webPlayer.isPlaying
            , finishedPlayback = webPlayer.finishedPlayback
            , webPlayerWidth = webPlayer.width
            , webPlayerHeight = webPlayer.height;

        let getImagePlayerHtml;

        /* html partial used in one of two scenarios:
         * 1) the web player has just loaded and paused => we want to show a preview
         * 2) the web player is playing => we want to use css transitions to fade the images in/out */
        getImagePlayerHtml = () => {
            return (
                <div key={"image-container-" + activeActorId} id="image-container"
                     className={"image-container-" + activeActorId}
                     style={this.buildCssStyles(activeActor, isPlaying, (speechTrackEl ? speechTrackEl.paused : true))}
                >
                    <img src={this.getImageSrc(activeActor) + this.getImgixProperties()} />
                </div>
            )
        };

        return (
            <div id="web-player" className="">
                <div id="main-stage-container" className={"stage-container" + (webPlayer.isPlaying ? " playing" : " paused")}
                    onClick={this.togglePlayerState}
                >
                    <div id="controls-overlay"></div>

                    /* if the current active actor type is IMAGE - show this UI */
                    {activeActorType === CONSTANTS.actor.type.IMAGE && webPlayerWidth >= 0 && webPlayerHeight >= 0 ?
                        <div id="stage">
                            {webPlayer.isPlaying || finishedPlayback ?
                                /* Allows for fade fx on image assets */
                                <ReactCSSTransitionGroup
                                    transitionName="example"
                                    transitionAppear={true}
                                    transitionAppearTimeout={actorFadeInTimeout}
                                    transitionEnterTimeout={actorFadeInTimeout}
                                    transitionLeaveTimeout={actorFadeOutTimeout}
                                >
                                    {getImagePlayerHtml()}
                                </ReactCSSTransitionGroup>
                            :
                                /* want to make sure we don't add image fx while paused */
                                getImagePlayerHtml()
                            }
                        </div>
                    :   /* if the current active actor type is VIDEO - show this UI (NOT IMPLEMENTED IN THIS VERSION) */
                        activeActorType === CONSTANTS.actor.type.VIDEO ?
                            <video id="video-container" src={activeActor.src} width={activeActor.width} height={activeActor.height} controls>Your browser does not support HTML5 video.</video>
                        : null
                    }
                </div>
            </div>
        )
    }
}

export default WebPlayerComponent
