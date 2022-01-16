import React, { useState, useRef, useEffect} from 'react'

import Draggable from 'react-draggable';

import { css } from '@emotion/react'

import { useSelector, useDispatch } from 'react-redux';
import { Segment, httpRequestState, MainMenuStateNames } from '../types'
import {
  selectIsPlaying, selectCurrentlyAt, selectSegments, selectActiveSegmentIndex, selectDuration,
  setIsPlaying, selectVideoURL, setCurrentlyAt, setClickTriggered, selectTimelineZoom, setTimelineScrollPosition, selectTimelineScrollPosition, setWaveformImages
} from '../redux/videoSlice'

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faSpinner } from "@fortawesome/free-solid-svg-icons";

import useResizeObserver from "use-resize-observer";

import { Waveform } from '../util/waveform'
import { convertMsToReadableString } from '../util/utilityFunctions';
import { GlobalHotKeys } from 'react-hotkeys';
import { scrubberKeyMap } from '../globalKeys';

import './../i18n/config';
import { useTranslation } from 'react-i18next';
import { selectMainMenuState } from '../redux/mainMenuSlice';

/**
 * A container for visualizing the cutting of the video, as well as for controlling
 * the current position in the video
 * Its width corresponds to the duration of the video
 * TODO: Figure out why ResizeObserver does not update anymore if we stop passing the width to the SegmentsList
 */
const Timeline: React.FC<{}> = () => {

  // Init redux variables
  const dispatch = useDispatch();
  const duration = useSelector(selectDuration)
  const zoomMultiplicator = useSelector(selectTimelineZoom)
  const timelineScrollPosition = useSelector(selectTimelineScrollPosition)

  const refScrubber = useRef<HTMLDivElement>(null);
  const refTop = useRef<HTMLDivElement>(null);
  let { ref, width = 1, } = useResizeObserver<HTMLDivElement>();

  // Update the current time based on the position clicked on the timeline
  const setCurrentlyAtToClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    let rect = e.currentTarget.getBoundingClientRect()
    let offsetX = e.clientX - rect.left
    dispatch(setClickTriggered(true))
    dispatch(setCurrentlyAt((offsetX / (width)) * (duration)))
  }

  // Center on scrubber when zooming
  useEffect(() => {
    if (zoomMultiplicator && refScrubber.current) {
      refScrubber.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }, [zoomMultiplicator]);

  // Apply horizonal scrolling when scrolled from somewhere else
  useEffect(() => {
    if (timelineScrollPosition !== undefined && refTop.current) {
      refTop.current.scrollTo(timelineScrollPosition * refTop.current.scrollWidth, 0)
    }
  }, [timelineScrollPosition]);

  // Store current scrolling position when scrolling
  const onScroll = (e: any) => {
    if (refTop.current) {
      dispatch(setTimelineScrollPosition(refTop.current?.scrollLeft / refTop.current?.scrollWidth))
    }
  }

  const timelineStyle = css({
    position: 'relative',     // Need to set position for Draggable bounds to work
    height: '250px',
    width: 100 * zoomMultiplicator + '%',
  });

  return (
  <div css={{overflow: 'auto'}} ref={refTop} onScroll={onScroll}>
    <div ref={ref} css={timelineStyle} title="Timeline" onMouseDown={e => setCurrentlyAtToClick(e)}>
      <Scrubber timelineWidth={width} parentRef={refScrubber}/>
      <div css={{height: '230px'}} >
        <Waveforms />
        <SegmentsList timelineWidth={width}/>
      </div>
    </div>
  </div>
  );
};

/**
 * Displays and defines the current position in the video
 * @param param0
 */
const Scrubber: React.FC<{timelineWidth: number, parentRef: React.RefObject<HTMLDivElement>}> = ({timelineWidth, parentRef}) => {

  const { t } = useTranslation();

  // Init redux variables
  const dispatch = useDispatch();
  const isPlaying = useSelector(selectIsPlaying)
  const currentlyAt = useSelector(selectCurrentlyAt)
  const duration = useSelector(selectDuration)
  const activeSegmentIndex = useSelector(selectActiveSegmentIndex)  // For ARIA information display
  const segments = useSelector(selectSegments)                      // For ARIA information display
  const mainMenuState = useSelector(selectMainMenuState)            // For hotkey enabling/disabling

  // Init state variables
  const [controlledPosition, setControlledPosition] = useState({x: 0,y: 0,});
  const [isGrabbed, setIsGrabbed] = useState(false)
  const [wasPlayingWhenGrabbed, setWasPlayingWhenGrabbed] = useState(false)
  const [keyboardJumpDelta, setKeyboardJumpDelta] = useState(1000)  // In milliseconds. For keyboard navigation
  const wasCurrentlyAtRef = useRef(0)

  // Reposition scrubber when the current x position was changed externally
  useEffect(() => {
    if(currentlyAt !== wasCurrentlyAtRef.current && !isGrabbed) {
      updateXPos();
      wasCurrentlyAtRef.current = currentlyAt;
    }

    // Scroll timeline if zoomed in and the scrubber leaves the view
    if (parentRef.current) {
      parentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  })

  // Reposition scrubber when the timeline width changes
  useEffect(() => {
    if(currentlyAt && duration) {
      setControlledPosition({x: (currentlyAt / duration) * (timelineWidth), y: 0});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineWidth])

  // Callback for when the scrubber gets dragged by the user
  const onControlledDrag = (e: any, position: any) => {
    // Update position
    const {x} = position
    dispatch(setCurrentlyAt((x / timelineWidth) * (duration)))
  };

  // Callback for when the position changes by something other than dragging
  const updateXPos = () => {
    setControlledPosition({x: (currentlyAt / duration) * (timelineWidth), y: 0});
  };

  const onStartDrag = () => {
    setIsGrabbed(true)

    // Halt video playback
    if (isPlaying) {
      setWasPlayingWhenGrabbed(true)
      dispatch(setIsPlaying(false))
    } else {
      setWasPlayingWhenGrabbed(false)
    }
  }

  const onStopDrag = (e: any, position: any) => {
    // Update position
    const {x} = position;
    setControlledPosition({x, y: 0});
    dispatch(setCurrentlyAt((x / timelineWidth) * (duration)));

    setIsGrabbed(false)
    // Resume video playback
    if (wasPlayingWhenGrabbed) {
      dispatch(setIsPlaying(true))
    }
  }

  // Callbacks for keyboard controls
  // TODO: Better increases and decreases than ten intervals
  // TODO: Additional helpful controls (e.g. jump to start/end of segment/next segment)
  const handlers = {
    left: () => dispatch(setCurrentlyAt(Math.max(currentlyAt - keyboardJumpDelta, 0))),
    right: () => dispatch(setCurrentlyAt(Math.min(currentlyAt + keyboardJumpDelta, duration))),
    increase: () => setKeyboardJumpDelta(keyboardJumpDelta => Math.min(keyboardJumpDelta * 10, 1000000)),
    decrease: () => setKeyboardJumpDelta(keyboardJumpDelta => Math.max(keyboardJumpDelta / 10, 1))
  }

  const scrubberStyle = css({
    backgroundColor: 'white',
    height: '240px',
    width: '1px',
    position: 'absolute' as 'absolute',
    zIndex: 2,
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  });

  const scrubberDragHandleStyle = css({
    // Base style
    background: "white",
    color: "black",
    display: "inline-block",
    height: "10px",
    position: "relative",
    width: "20px",
    "&:after": {
      borderTop: '10px solid white',
      borderLeft: '10px solid transparent',
      borderRight: '10px solid transparent',
      content: '""',
      height: 0,
      left: 0,
      position: "absolute",
      top: "10px",
      width: 0,
    },
    // Animation
    cursor: isGrabbed ? "grabbing" : "grab",
    transitionDuration: "0.3s",
    transitionProperty: "transform",
    "&:hover": {
      transform: 'scale(1.1)',
    },
    "&:focus": {
      transform: 'scale(1.1)',
    },
    "&:active": {
      transform: 'scale(0.9)',
    },
  })

  const scrubberDragHandleIconStyle = css({
    transform: 'scaleY(0.7) rotate(90deg)',
    paddingRight: '5px',
    color: "black"
  })

  // // Possible TODO: Find a way to use ariaLive in a way that only the latest change is announced
  // const keyboardUpdateMessage = () => {
  //   return currentlyAt +  " Milliseconds"
  // }

  return (
    <GlobalHotKeys keyMap={scrubberKeyMap} handlers={mainMenuState === MainMenuStateNames.cutting ? handlers: {}} allowChanges={true}>
      <Draggable
        onDrag={onControlledDrag}
        onStart={onStartDrag}
        onStop={onStopDrag}
        axis="x"
        bounds="parent"
        position={controlledPosition}
        nodeRef={parentRef}
        >
          <div ref={parentRef} css={scrubberStyle}>

            <div css={scrubberDragHandleStyle} aria-grabbed={isGrabbed}
              aria-label={t("timeline.scrubber-text-aria",
                         {currentTime: convertMsToReadableString(currentlyAt), segment: activeSegmentIndex,
                          segmentStatus: (segments[activeSegmentIndex].deleted ? "Deleted" : "Alive"),
                          moveLeft: scrubberKeyMap[handlers.left.name],
                          moveRight: scrubberKeyMap[handlers.right.name],
                          increase: scrubberKeyMap[handlers.increase.name],
                          decrease: scrubberKeyMap[handlers.decrease.name] })}
              tabIndex={0}>
              <FontAwesomeIcon css={scrubberDragHandleIconStyle} icon={faBars} size="1x" />
            </div>
          </div>
      </Draggable>
    </GlobalHotKeys>
  );
};

/**
 * Container responsible for rendering the segments that are created when cutting
 */
const SegmentsList: React.FC<{timelineWidth: number}> = ({timelineWidth}) => {

  const { t } = useTranslation();

  // Init redux variables
  const segments = useSelector(selectSegments)
  const duration = useSelector(selectDuration)
  const activeSegmentIndex = useSelector(selectActiveSegmentIndex)

  /**
   * Returns a background color based on whether the segment is to be deleted
   * and whether the segment is currently active
   */
  const bgColor = (deleted: boolean, active: boolean) => {
    if (!deleted && !active) {
      return 'rgba(0, 0, 255, 0.4)'
    } else if (deleted && !active) {
      return `repeating-linear-gradient(
                -45deg,
                rgba(255, 45, 45, 0.4),
                rgba(255, 45, 45, 0.4) 10px,
                rgba(255, 0, 0, 0.4) 10px,
                rgba(255, 0, 0, 0.4) 20px);`
    } else if (!deleted && active) {
      return 'rgba(0, 0, 200, 0.4)'
    } else if (deleted && active) {
      return `repeating-linear-gradient(
                -45deg,
                rgba(200, 45, 45, 0.4),
                rgba(200, 45, 45, 0.4) 10px,
                rgba(200, 0, 0, 0.4) 10px,
                rgba(200, 0, 0, 0.4) 20px);`
    }
  }

  // Render the individual segments
  const renderedSegments = () => {
    return (
      segments.map( (segment: Segment, index: number) => (
        <div key={segment.id} title={t("timeline.segment-tooltip", {segment: index})}
          aria-label={t("timeline.segments-text-aria",
                     {segment: index,
                      segmentStatus: (segment.deleted ? "Deleted" : "Alive"),
                      start: convertMsToReadableString(segment.start),
                      end: convertMsToReadableString(segment.end) })}
          tabIndex={0}
        css={{
          background: bgColor(segment.deleted, activeSegmentIndex === index),
          borderRadius: '5px',
          borderStyle: activeSegmentIndex === index ? 'dashed' : 'solid',
          borderColor: 'white',
          borderWidth: '1px',
          boxSizing: 'border-box',
          width: ((segment.end - segment.start) / duration) * 100 + '%',
          height: '230px',
          zIndex: 1,
        }}>
        </div>
      ))
    );
  }

  const segmentsStyle = css({
    display: 'flex',
    flexDirection: 'row' as const,
    paddingTop: '10px',
  })

  return (
    <div css={segmentsStyle} title="Segments">
      {renderedSegments()}
    </div>
  );
};

/**
 * Generates waveform images and displays them
 */
const Waveforms: React.FC<{}> = () => {

  const { t } = useTranslation();

  const dispatch = useDispatch();
  const videoURLs = useSelector(selectVideoURL)
  const videoURLStatus = useSelector((state: { videoState: { status: httpRequestState["status"] } }) => state.videoState.status);

  // Update based on current fetching status
  const [images, setImages] = useState<string[]>([])
  const [waveformWorkerError, setWaveformWorkerError] = useState<boolean>(false)
  images[0]=`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD6AAAADmCAYAAADBNnqaAAAACXBIWXMAAAABAAAAAQBPJcTWAAAQ
  AElEQVR4nOzb0XLruo4o2v3/Pz3v2dWVajcvAIIUZcvJGC9JLBIAQUp2stb8z38AAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADg1/r3/3y6Bt7LngMAAAAAAAAAAAAAAADAG/mHfcA3
  8cz6e+w5AAAAAAAAAAAAAMCX8j+EA5DJ3iO8d8Az7NyL337/fnv9/E3O7f/Qh3Xf3rNvrx8AAAAA
  AB7FH94BAAAAAHgnf5cGIFP9A3TvH/B57/gH6E+7159Wz1/2l/fi2++jU57eh5P5PrWHTzs7V/f8
  aet5im/ty7fWDQAAvNmpXx78EgIA8Lc/E/3ltQPcwXMV4DrPUgAA/gKfe4En84y67koPf+ZG/3jI
  3sA9Vu6tnXtxdc7T7vWn1fNfJ2p64rpmvrHmU57+D6/fZbauT//j4yjf7vPPP0D/H+/8B+hPW/ud
  vnWt31o3AIS+7Y3tyfU+uban0zt+K/8AHQDgnL/8megvrx3gDp6r/DV3nnn3099l7wEAfgef62r6
  c50ewn3cXz1Vn3Z7+PqPVLN/gG5/uNtf/Eee/gF67Wn1/Ne3/AP07Jm+Oj/7+Vvs1H117d/aq8jK
  P8r+9Jn5ln+AfsfnuLus1rp7Bu74nPm0Xr56cm2Vb60bAELf9Mb29D/KPbm2p7vSO33/v/TjWU7t
  x8l9/ZY/6AHwf/3lZ+83/8e9u1nv3/GX186a33JWfss6eC5njL/mU//jxxPicR97BefddV+5XwGo
  nPoHFr/VU9f51Loi31QrvNvV++PT99en83e8/j+nV/+hVTfuvxdXcrzTO2v8hn58i9Ve/ober/x/
  5Dv/z/nqnKf1dFbPJ+rt5Lyj7t37Y/e9InsvuFrXSSf2ojOnivG0npz2upbVc/3uPkRntHoGVvVe
  +Tw1i7F6nlbznqytGtc5+3e+v3Vinox30pNrq3xr3QAQ+qY3ts6HpU/+4v9NvXynUx/Sq7m/tffv
  +KMJsVN9fFqcU7GcM4D3+8vP3rs+4/+Gnt65hif254k1vcs3rf2bav2Nfkv/f8s6Vt217r/az8pP
  Tzr/ofc3+gtr5H/d/ffTv/x39r/+d7Zvrf1b6+ZvuOu54tz/fvYY7vFX7q3dderPZz21rsjO/wf0
  7pzwKVfPanf+XX+/+YZ77fVvY2O9V/5u1on7LX26+++HUb4Tc951/zzZznvst//dYOW8zsZmvVjp
  x9N6N6vn9fqpe/HEnJW6u6+tPoOr8Z3XXueP7wOzWO+yshdX7oNo7U/tyWkr91h2hu7MP17v7F01
  dvx+dX87MbrzO+NX5o33dBans+ezs796373GO3X/VOv8tNV7qTvvbp/OD/A1um9Cu28I3Rp25/4V
  39Sjzpla/dB5cv3v7uXVfDvz75pTffiefSg8tY9PvBc6v5REc576QbpjZ8131XHXuZr9whlde8ez
  aiXHk3/RBDjtE5+57ozzTp9Y+11jn+rONTyxP0+s6V2+ae3fVOtv9Fs+q79zDSd7tvJ3qTvriGLf
  EfdU3k+8f1e/b/+Ge2jmL6yR/3X3e8Pp2DvxPvV7wF1/P/wWn/zccSXv03r+tHpOufq56HxFzzBb
  24m/Q/3Vzzd36PTtKe9b9hju8Vvurbvef+7uzzv6f/JZ/+7zcuXz1rtltb2+3vl+N/bO/JOevDe/
  0bf1++rvt93fzU+8F0T35jf0+98gev1k3Ch2ljfKfWdPq2fmyrN3JcepNc7i7NR/utefuB9Wc47n
  8pvu5R8r9+3sPs/OVRX/rjNeWYk3G3v1Xl+JX+Xs9LETt3p+Zc/gTm07+/wvMath9vpJnRzd58Ks
  r1V/duq6Mv6don2v9vzqPdmJV90j1d5VYzu5shzR+KpvVV9ma1idN6ttFqfqXdaHrOfd+qvaOrGy
  tazMO5G/k2M118kaduzswV21AGy74+G08+bdqaX60HE19sqc3/pA/6Z1VR/AXsdUP0fx3lnfTrzd
  6534T5lTfRCuPnCP33fnr4xbdccH5pW4VT924q26GndnL3dideae6FF0rmd7FF2761x1Xs/G3nWG
  eB97yCfMPtu8s5auk+9tT4jzTp9Y+2zsOz4PdXLfHfPk55gnOV3Tynn5tOz3op15d3tK355Sx7ud
  /qz+qT6+M++/wercMU52vVvHat47xp+ysp5Z7078fhzt1zc9XzM7tXyy/if1LvPkGnf3e/dzz879
  cPUz6qkz3a3j1HNlZ+y4N51n3TvO58nn92lZj66cgTtcORur701PfWZdeTY8dU0n7D6Pu+OufL7Z
  zflbvPNzYed5/zr25LidsZ1xv9FKn77Fb1vPSZ/83LBit57d959T71u73v257eo5WHm+n/Cuz+In
  noevMbKed77PYkc/d/fz3eeM3Kln3Df1+9+Lu+efeKZH9+Zd702n/AtEr5+InV37+bkzLxqbXavm
  RbXM6qjyrqhqXjk3nbVXa9up9eS4Kz1cqWX1DGf7frrek/Fm99dsbjU2ujaL3T2bs9q6Vu/Plevj
  /s9yZddn9UVn7UTfs7OcXcviROvp1NepqdujWW1VvSs6fc5qrnpS9WL8ebau7jpWxq/GvhI/6ku2
  5jHXydxZ/ihftk9VbdHcWfyx1vFrFivryazWqpfR9Sp/tY6ovyt9mPUxqzFb/zi2a9az1XmzNXTG
  jjlWYkavR/uyEq8aV61rJ943+LZ64c84fXPecbNHD+jum0F1bfcN8cqb4Mrr3+6d67r6Jhqdidm5
  q3LNPoysGuNldaysv1P/a8yVtUS9W50zvn7ifu3UNY6vet19jmQ/ZzGqXsz2LbtWje32ttOPlXir
  dmNEfZ6d71muWf86tWQ968bL4mTna9aDE7IzurOmUzU9yW9dV+QvrZW53WfmlTynrt1Ry8ncp2rv
  PntX831qv++KM+vTlc8H3bF3xpjFXP3ssHrfvfO9I8u/ex/srOdJn3t29+P058jO9Ts+w+7I8l85
  W9/gdS2ffHY95f2zE//f4Gqc7HonVve+vlLnO3Xfdzu9WznXnfu/2vNO3U96ZuzU8o76u727ct+c
  qml33NU5O3Zrmz07rpz17h6+u/+7Z3Alz8ozOasxeuZ0nplX+tQ5D929r/p5x32R9aj7PH+t+QnP
  m7G2n6+zs3Z3n0+48mzYPeOd2J82u4d3773ZtU5Pr15/pzufL6t5Zs/T6vUr+z17TuzErGqdvfYb
  nXoWPcW3r2d87zu9lu5z+dM97H4GWK076mnn/Wr3Pa177VS/r+ZbfWa+634b309O5Mye+1dj/xtE
  +aLvX8ev3KcrZ/Nk/2Y1zcatxt2J8WQra6nOzrvuwRPGeleegdl9VY1f+bnK+Tp+t+ede3RnXVG9
  Ua+q/nXXMotR7W00L6tzvJ7VWvW004NOrPF6NKeKFc2b5ahqqno1i98ZF/WmG687Z1XUl5Vc0b53
  Y6zmORFnHJ+d5Wputb7o2qwf2fi79j+KfaW/WT+zXLNaxq+z/mR70l1XFCeLn13Pau6sI+tllTvL
  01ljNqYTJ7tW9bpT/2xslCcbN46P1lj1oVrLrqsxs/5V467mzvqR9TSrIdrTKPZsXLXGrLYoRtW/
  qI5O3nHMrKbOOsbcq33I1j7rW7b+amzWiyrnzCx/5/Xufl2NGe1LJ15nXLb3VX2d157s2+qFP2P1
  gdmJt3I9emNbmZONnY1ZfUOq8nffFHfe1L7VqXV1Y1x9E43OxOzcVWd3jDeroXPfjHbiZGup2sna
  WAAAEABJREFUrldrqOZ3cr3Gnt0fVU2zPlf71M35+nO1F9Fasp/H8Z11zOob50XjxrHR97PeRPNm
  c6PaKp396lzPehd9rWJV6+2ub6wlitGNV8WZ5Vhde1dW+05/dmt4gqz+b1/Xiqtr/Q3n4JO6z5C7
  c0Rj79zXKvbutZ3xK+d3fE6v1LE7Z1bHqXzVe8LKc/LKMzU7e7tnctanTtzV98mVs9QZtyL7jDB7
  v+68n6/24aSsvk7dP+Nmr2XxV/JduSdXe7m7Hyvnc3Z/dPs+fv2U1Xv8qfXujBmtxqjGr5yplTyn
  8q7Gr/q1uidX+9193uyc191n2c61rIezGmb9r871rLbX/a5yRrXOaq7qqOafnLd7JrpjdtY562/2
  885aurV19rtbY/X1bjt5OvfP7PWdnuzEymJnVs5aJ9/O3O6eZD2L7oGoV+OcbB1V/7K80Zo6a8vq
  6NQyM1vfmKfqSTVvpabd+rt9rPYnOivd+FftxI/6XJ25av6VmlZyrsTdzftzrVrf7NosRuf13fVn
  cas5q/FW5nbWsZIju/fG76v7saolen22J1W+qNZuLdU5mdVafX+X2dpOxL877859t5t79Yx0zuET
  dM7wqfjV6yt7eUeNr2vvnJ/x2dU5H9GcrA/VXuyet2ivx9eqHJ1843qr/mRrnK2vOjtVXdV6Zutb
  rbOKNV7bqS3by6jnY+6ol7O9iPY0qy2bv7rOKF4UKzsT3f2Z5VqJsTLm3Wb3RPe87O7lJ8zuidl5
  6K63eyZfv2bXsn6v9jwbH+XaiZPV2Dkv3bXMYkT5qnlZneP1rNaqpzuytbzmmtUfrT1bSzd2tLYs
  T9W7bFzWu9ncqOZqfd3XOzV3576Oj3TmreTYuTabE9Wc7Xs0vtO/KHZVZ1VTZ32Zcc1VzbM84/yq
  7modWS2dHs9yZOuKxmW5q5pm82e1ZK9la53VUMUfv87GZT3LrkX5u2uYjc3yVHGqdXV6Va13x9WY
  0VqrNXfXU9WU9XnMv7pPnWvZ+GyNYx1RbdnX2XpnebP+R3GrfkZxshhZPVWOWb6qtipvVGenn1H+
  qgfja1H8rNYsV2etVa6srp31dNdZ1THWv/raXVbzZ/uxEgO4Qfbg+bk2m7s7p3oQZjXOxmVxZ/Gq
  +rOH/OvrUayVB3fn4VjF6M7tjj2VY+xRd+5Ozmrfsz0cf56dsXFctXez6+NrnT2J8o61ds9StL7s
  +tiTKP9sbZ3+ZHGiMbOvnRgr47MeRPGq9Y55s1hVXd31VHVmY7u9jPJ36s+uZbL+VuOznFmPs7q6
  Pat6XK2p62SsLP6Yp7OOTk1RzNnr3bXv1nplbVfzrKzrN6jWOvbiG/qV1fiJWrLcUU9n+zAbs1pD
  Z+ydfctiz87TyWfJznMsmnPiObhTRzZv57xka6rq6txrK7VkPa16vdrTWdxO/GpNq2fh1JkYY0Vn
  pNqbWa5Or6o5q6K1RPV2etQ9p7O9j3JmPa9q2enlSv1ZrJXzlNVZ1TCrJ6vvyjlZiVP1JXptp65T
  a6lizfYlGl/dL9W5WblPdvvfqb+qZeVMd/NE/ermG/enOu+dWN1zsNrfbuyq5mpclqdbd9Tv6gxk
  5yQbG42Prke1rtScjev0IIvfud6pt6orm7fa79cxVX+y3NmeVHk764v6lNXfrXF8LcvZrXdFJ05U
  /6y3s/2qetTpSfZ6p65q3Z2ztrK/2Zhq7mzs7PyMr0fjZnNm+aJ+ZfuQjalyVLFmPa1qzWqP+ln1
  JKs5yntCVudsfLa2KE7U8zHmOC6au7KWFd39qGqsclc1Vb2v+hK9vvJzd8+ztXX3uooxiz87F7O9
  HmPP9mmmk29Wy2zebA9nMaO+RXvUqSV6PduTKn41pxtnttbXn6N9rnp8ytUe7+YaX1+Nv3MWOudg
  Jd/qGcnGP033TOzG7p7x3XuwU0O3zqiGqs5MVn93fDR2tqaq9ihOFH8cX+WM8s3WG9VX1T3ryyzn
  rGedHLO+ztZejR/HdWXrj0Trz2qs6pv1N4qd5armZWuqYlU1RnGz/Nn6O+Nm855gtpasp52+7uS/
  Oq4bK6t7tpZo7msvumPHdUX5Ov2u6o1id2vt9LC6VvUoy1X1p1trlq/Knb2WxRz7GNVY9WFHte7O
  2Kze6PssdrfHnf6Mr0U/Z7Vm8arr2Vq7c1fWVs2vzOat5KhyZ/Nm8aJ6q15Ua8zqme1FFqOal9Ub
  rTdbc3Qtm7ta85irs45ZrOj6rGfj3KqmLHdHVdtsnTv9qHJnex7tW2dcdgaytWRrquqvxlZ5snHR
  ujp5oz04IasxGlfN7/an06cxX3atiputrcrfubYyp9uj7Ou4hm782T5Ffaz6GcWZxa3WWMnWvzs2
  6+FK32Z70lnXmCPKWa2lul6tJVt7taer+9Rda5Z71vNozK5onePPY+3Z9aqukzUDgZWHTDQ2ixXF
  rGJkD8BZzCpHNqbKV/Wn6leWd5yXjcnqGuuJ+pDVla1hZY0reTq1RnFWdNcy24vZPmZ72pkX1ZmN
  q2JX653VPM6PcmTxqutZzPF6tv7Z9e6Yznqz/mV5sh5UY2a1dGJ2e7rTizFHt6YodzUnm5fVn/U7
  yjnrWxR7jDfrc7aWldxjzGh9WY2rTsaKYo95Zmvorm98vco1Xu/WsFprVtdpUdyVdf0G496O18Zz
  EP28eh6yfCdEtVzd02xuJ2Z0lqt7K5qb3X/dWnb35c77oOrpSi9287zmis5wlCc767Naxn3L9q/z
  2vh6dRZW9z1aU1ZvFj+bl8Wo1hXlqerM4kV1zNY7W+NKT3bWGdXSjRnlqPYjujbWVMXLaszW0+nd
  rL5O/qgvs9qqeVHO2ZxZPVGcmSh/p7edfkXjs/o6fc96NovdybE6NstX9aubd2cfO3HHmDvnp9qH
  WYyoV1n/Zn3d7U0Vv6oni5ONic7n2K+s/7M41fXZmrN41etV7GqN2bqyNY/fR/Oqns16kK25OybK
  Va09i5flmI3LRHOi61lPOrGy77NaorzRnKwXVa2z9Va5s77O1hPVF31f1RPVNMbI+tGtv9qbFZ2+
  ZuupejuOidYVjc16kNUxy9u5PssZ1ZX1KorV6XM2rqq927NqXLf/45hOP7vzu/VHr4/9HPNHMaMa
  V3oS1V6t8YSqzmr8bG3jerL+znJ215z1tRMn249oPbN9yuJXuccaomu7a47qneXt5Jjt5zgny5Nd
  q9bVqTuqpaojyjP7eTa/qjerKetvtwed/s96MNuL7OcsfqeO7LUqZvVaZ260/iuqWrJxJ3KNr8/i
  V/VEe1LlyL6u1l71qnrtrv6eMjuzV2OP8WfXuv2tfu5ee42fnass1zivcz46c6qxnb7NcnViRzmi
  dWX9qeJlcaM1dfpe5azqjKzU3V17Z3xVW9aLqI+RKE7Vt6oXWc1Vb7J6ZuuM5lW1ZjVGc6O8WX1Z
  rqz+LM8TzNaS9a/T1ypnFL8756psLeO17txZnKpHVb5ZrizurK6xn7NYWV0r/Z3VHfUiGhPFz66N
  tc7W2bneqWG3Dyt1VLV0Y0T9qc5GVkMWIxrXjdG5HvV6rH8ck33fmVv1IopbzY9k86P1ZrKxUa3j
  9Vm8WQ/GGNkaq3lVL6q8Wa7o5+jrLM/OeqIcO7V219utqXp9tncrdVT1Za91zlzUq93aOmekU9t4
  fsYzldUdzZ3Ve2KPuutayRvFzPpQiWoZY1fxu+uOrnXGR7lnOaP4s5+711bm7NQb9b2Kn8Ws9mkW
  t7uGKO5O71bzjvl39nLWz6xvK73r5B33KFt3dX1ljVWs7LysrGd2fVxr9Vo0ZldUV5ar6s24rirf
  1ZqBQnRjRjfe7KYeY43xsgdH9IDL5kRjV+Z253TXOMubjc1+jmJmvY36V+Xq7NFszEqerNZqbDdO
  taasn7NaVlXzqh7O4kT9HmN1a4760ImV9T2KNctf1dvtz8qar9SSzanGVPmqOrpxxljd+dW5Wqkp
  OkPdfYtizM5d9+eVmsecndzVWmc/z+LM+tARxdiNFcWOfo7ydWR1j7mi16v5WS1ZzVV91c+rsrWs
  rquKf7XGT6nOQnYGszFZjCxvVVN3bLWeqrZu7teYK69n8aIeRnWP16Kx1ZjZmjLZXp9W9TNaS3Qt
  GzfLE8Wc9T4aP8uR1Rz1NoqZ5ZnFjGrv9iDLlcWv+pPVOatlrH2WIxs/q6OKW73eyX2l51k/outR
  zGxu5/qsl9UeROvsrDvLVeWrYo31z3J1+xHl7OTKepDlr3pY1ZH1I+vhTp2z2qp8WQ1jnFneKmfn
  +uu4qBdZj7L4u/XOdOrt7Oes769fZ2uuxkS1VfM6OudkzB/licZFvYley3T7McudrbuqJRsz60PU
  u9kaolxR/VGsqgfVmqq51Rq69UXju3s/68cYc3Vfx3VG+zaL2dnjzh5Wc7IxnX5l64h6kK2jWlP0
  Nfu+05us7qi27ppn+Vd1+pH1fNbjzrXxtWx+1Zvu6yt9ndUb9arbn06+aH+quFmu2evd/q/kvBpj
  Vkt1blf3YCfvSo7onFR1R2vofF+trbMf1Zqr/OPaqrVkdXXjRPO666pyZ7VU9a/0pbPmMWY2P8o3
  W3O29uq1rPed9VVrm9U2i5f1b5YzylvNndXUWUPVuyxm9XNW50rtmWwtnf3Jvl+JNbsW7dWurL4x
  /ol8Udwob9WzKE5VdzQn6nG1xk7dUdwq/139vRpjjDPraydOFa9zrbv/1ZxZXeP1WZ1ZvEwUvzun
  MzYbszK/q9qD8fXZeqPeRjnGMd31ZONm+z/LVa0rmpetJxv/OrbqUfZa1ZNM1ausxtmeVq9F64h6
  srKmaOxs/6J53T3N9qPa4yfprP/1+64o9muO8ftZb7JYu+uN6h2vd+fO4nR6tJuvije7VuWpep7N
  3627U2/Vl+zaWFsnT6eOauzJHszyruZa6c+sn1WM2bhOjKvXxzM7vh6tcay/W3MWd/c8ZPVlNUd5
  OjGyWFmebu2zNUfXZvXv1hL9XOVfzZOtdbZvV2rdrWk1912qfs1yd/t9tbaonupsjOfnP4lOzll9
  nVjdOKfyjnFmfYj6MsYfv+/G76xl5fXOOjvjx7Gzn3dqm83p9Gist9qTlVqqPVpdX3cPu2fiSs5T
  cXbP7u6eZHNm92U0v3uWZ6+PsbJ754qq1ipfdl+MZ7tjt+6x1qqfUc6dWoGm6sYcx2VjZz/PHgwd
  r7Wu5KpirdY369fV/NUejD9X9XVq7taQzZmNi85ZVFMWd5w7fr9aU9SDKzpxqr3qxKn6slLj6pqj
  vVyZP87dXX83xmo93TpOnpcrMXf2YyXHak27+/qfwWrNu+c++9qNHdW7uyezHqy664xGP4+5svVk
  48c5K7mzWqqfoxrHa1Ft2dq6olhR/bN1ZbGr/j/dylmozkHVzyxv9trsPHXWMqt9FiOLOxs71jub
  k/Uyu1aNreqpasrW2p2zo6pzZb3VvNc83XwreWY5OusYx87mzuoe64m+n/U7ijGLX9UVrSdSrXdW
  c/fV/ykAABAASURBVKf2bn3V/G7fKp01dMaNeaMaZ33ozO3Gi9Y5G1/lWhH1baWH3TlV7qyWbE9n
  +aP5UR3Za9WcbNzK+Gx+NjeLN8Yer0Xxs5zV61neKHe23k6OqCc7qvqyMVV9ker6a7zZ2CxmVsNO
  D6qYnXVU3++o9mil79m6V/YmqynL0a1rJXYWsxNjlnslTud6NH5nTpVvZ187ucbY2fUsTjQnWv/r
  uM7ZyfJW6145j9nrVX3ZWmdxsnq6un2q1pH1P5PF2V3nah+646OaOnE69Waxo7lRT1bzdceuxF2Z
  U9Wwk2ecfzVGJ0eUc+WMXqlxJcd4tl6/jt9na1g5M6f7X8XKas3Wkp21bpyV2qIcnfV188z63Kk5
  W3OVd8Ws79Vrs33bXf+stixOdJaqn8ccY75sXFVLtoYTOrGyvp+oI4uxEvtKXZ2z8vP9FWOcKFd2
  Xk7ky/JmPejWHdU+xs1er+qr6o7iZjGyNc2+j36e1TiTrSta42r8bJ1Rz6prnRhRb6McWdzZmrtj
  K1Xt2fjVHN3cp2JlcaNz0NmfWY6rPY/yjjVH31dxO2e3U2OWZyXeyTMz1hfVMNvT6rXo2jhup5cr
  NVbzdmPM1tG1Mz6bk9WXrSf7vquqp9u/qM6VfsxiddexMnd17NV8s3i7qtqyn+/U6cvOtVn90fm7
  UuOuzn6sxhj3cmV8Fb8Tq1vjap2vNWT1RGNWVXX8J7CbI6o9ugdX1ljVdldvVudFvbxaR3U+X3Nl
  8ztzro7r1npHrne5I9/pmFH/q7Mxjh/vsWpPVvfqZKzVsdWc2f1bWa0p6nd3/one7czJzkwn1qna
  dvrTvQdmMWdn94So9jvz7bhy/mZjTpyTcZ92cq6u8eQ9uSo60501jfM6stjdOqOc1dgoN3CT7GHR
  uWl3nY53hztrXImd9X+1vu5+nxKdsWjM7Nr4tZo3W9PJNXdidXqwk3dn73fHX63/1PxTPTxx713N
  /479uHudu/f2lZ7e+cxafXbs7skd5/mOM9rJNa7n59r4NYpR5Vj5eRa36nlWXzYvWu+sB1XN1fqr
  urO1fYOo/pW+VP2q+hJdy/o91paN79SdzY9iVGuM5mU1ZrE6tXdq6tY5js16XdVyShSvs/6u2TpX
  40bjozgr8V/rulLHbNz4/W5PT9SV1dH5vpP7VE9Xz2N1rlfO3c7ZubKfq/2djav2tRN3dy07+31i
  37PrUR+iMZ2cs73uzp+N6ZzRbF3d8z2TnZ3sXFU96Z7DakzWw2q9UU92VOvJaoryr655Fn9m7Ht3
  XjT3ztquqvZoJ884t7P+1Tyz/ej2f9epfbp6/cScWa+u3Aed2qr8Wa7sjHbOxe4aqrO6ch6z1/8z
  mM2f9ebEud85n+PejN/PRHGifN11rvbh1Pgr/T+xdzux7hq7Mufk2u+M2cm3ci9erbFzH4z3Y3R9
  HDu7D6/WddLsORJdi2qNejTryUqNO/Ouxs5qns05VdtVs33r7Mmp9UT3UfR19z6Jzt9qjKs6sa7e
  CzuuPHtOPbeq50L2+uzZ0T272Tkbz+Qs76yeTk3durN96Mbv1h3FzdaerSPqYxRnpbfRuNnPWe+q
  +NWas3hj/m4/o3Hd3mZxqzWv5OvO/WaddWRnoxu38/1p2VmrztUszkrebN7s+jj2dI9W1zq7xzrj
  V2oYx3X7tJKjOz57zkTPrZnuuHHN3Vgr67+iqrPTk5XYs7VfqX1lfHfslfl36tT27jpnvdm9Nsu5
  Ov6Ovtx9VrL4OzGu1LRTx+r1E2e4qjN7Bu3kiGqP6s/WWMXorGGn7l3ZunZrqfY9G3/Xmk+t4Y45
  797nO5xew+w5VN1v4+uzM7xS++lYq2O7c6L7t7Ja01jPan1VzLvnZHPfcYavztvZq5+xs7N7Qnb/
  3ZVvx51n9MRax33aybn6fPrkHnXr7/Sh85w7tf+zsx3db50agU2dh0V1bcfpeHd4Uo1RLU+qr3K1
  zpW1z3Kd7Fk31nifnci7Gu9K/qv1n5p/qocrcU7v3W7M8Tn9lJp26rhS/yefeWPu7ntnFOfTz4Or
  +cbcP69lX6MY3Wf47OdOzOx6p2/RnJlu7CpfFDNbU1XD0+z05Koo789rr9fGGqPvo3krNez0YJyT
  1ZXVfirXO2JHc6Iz1D1rUV+qvCfOaFbjToyTds7g6fP6Kd09757J8fura7zS5859UMVYPQ9X1nrn
  ud4Zt1vPifviZP7o52xMlnO8fnWvZzlWzmjntSv1RN9neU/VU8VZzX3C6prGWjt72YnXzX/au/Nd
  lZ3d3ThVjM6Y2dxPOJX7jjXc3ZeT9+L4WvdezeZ0ni1X+3PyrGbr7fRhdl894f54rWPn/eLTz+5P
  ObnOlVhPfnZ8U97o/HfnXM3ZHXPlXDzpTI25Zs/Fbpwsdvas4l6dszvbk1N71n2v2r1PXp8fV2vd
  1X2evPteeNpz63X94x5WunVk9bzmHON28l6tJ6vr9Nyo7uj1LG40LppX7WGVr4pfze/EmuXs7O1K
  rWOeyOy8zK5Va1qpo5PvxPjfYHbusrG7MU7azXX6XHz6nK3ec9H9VN1jnftvZU2dsVUdJ/Nna3t9
  vXqmVtfHcWP81+tVLTtrXBHVW+WPal7JEcWa5Z7FXZ3Xjf3OfCueUMPoSk27c3fPzE6uT8rO4idq
  Gc3q+MS56MTsPPNO54xe77w3jHE+8RzK3quuPLvvHL8a+13Pkiet+11Or2H1mTN+3nh9fXaGV2o/
  GWtFtr7OvOheztbRjV/1e6W+q3NP5nv3Gd6ZFz2juzGvPMt3vTtfx51n9MRax33aybn6fPrkHnXr
  X3k2Vc+6U/s/O9vZ8xW4we5NDZ+0e3ZPnvlurNP32k68K/lP1H9i/ieeV3fkvRrzrl7snKmdOq7U
  /8n3rFO57zpTJ+N1c415f34ev0Yxqmsnautcv3J+M6vxshpX4mZ1zGr9hKv92VHl3b12soYn5Rhj
  RDF383RiR3OiMzQ7Y+O4nXqv+mTuykpNO/Xv7PO3+8QaX3PuPm/ffUbvyHUl5reufXaPVc/trI4o
  xt392c1x9zmq6jqVezVONT56/1u1Wt/p8/LOe/GJ+T9l9lyYXevG/4RP3aufivmu+N3YV56h33A/
  fkONXZ33jtfrnVj0Palnn6rlN7xXPMnKmt65/tkz5Or7y2uO37iv32L3/f9JZzEa33ntXVbulafe
  C2Ndd9WZ7V30+eauflW5orx313NKVt9K3VfWN/asE3/ch6jezppma+/sbRW/WlNm1vdZvGpNK3Xs
  znvyWb9L5ww/1bvOxbvjncxf3U/R3l+5f7s+vW+ddVfP6eq16tk7xl993t15zmb1ZvlXahr7Nn7d
  Wd/dPYleuzPnN7vSl3f21P6919PORfTsPp1jpZaV58yna41ee9ez++61P/W58NS6PmnWk/H6+Hkj
  Gn+iz7P74WlnePxMFrkaf2X8k1xd+2r80zFX4ld7frennZGn1RNZ2afVc7Bf1T1Or7N63l2pc7ee
  cQ583G87jCdvbHin3fP7iXN/+n7biXcl/4n6T8z/DXt3IuZdvdg5Uzt1XKn/k+9bp+/hU7HuiNfN
  Neb9+Xn8GsWorp2o7Y7xP3Pe8blqNW40flbrnbLaTvXnHU7W+21rf4duT6KzNTt747j7VjGv/VO5
  n+Iv9OATa3zN2XkOZzHeWfsdub7lfD2lz9m17H37dG0ncnyyrlO5T3++6DwPVp4Tq/W9+1ly2jfX
  fsXPuu9a/yf7+sR79c6Y79Kt/coav7k/3+j1OfD6LI9+/mSd/F6/4b3iW71z/e/6rPjtn0n/qm/b
  s2+o173Q+5/2x889d9TwGnf2O3n2+hNl/b0y/6QsfvR5dzdWFLfaw+y1Wexu7qtxorjvmPf0s36H
  8b7/ZC2cV+3p1Wfnrk+fs5UzHz2nq9dmz94sdlZf5/UTuvXemf+d83Zj3/Uex/vYv+9x5+fJzjPv
  btV7wNPOaVXnO2q9O8fT+v3jqXV90qwnq5+hTp3hTz9TdvJGz8NsHavxv/nsXl37avzTMVfiV3t+
  t6edkafVE/mGGp/uk2c+kz2D4a12D+NTD/Fnb2t4v0+c+9P32yfu36v5TtT7G/buNe4n559wpTfv
  nnfC6Xv4VKw74nVzjXlnP7++/sT7qpvjtf7x+7vyrdQ17tE7RL2Byso5eT1jP1+rszaO/5RP538C
  Pbhf9VzuzHtHjT/5viHmHZ7e53HOX38vv3vtJ+Nne/fuz2vffF6+ufYrnvJZ6a/Rb54keg/5+Tq+
  b3yiPn6/T56tv36uf+P6//rvMPDDvdD7R37j55531JH9jh6NuaOeUzr9XZ3/DtkZWJlTjav2Nnut
  E5vf5XXfnYHfZ3VP/8IZWD3z0d8lstc676uvcZ/yXtWp9067ed9d7zd8JgJy4/P/k/dzlvvTdUW+
  qdYdT13DU+t6suqsZq+f6POnP0ftmH2Wjcb+RafXfncvd363+MTZfdqZelo9kW+o8emq59ynZM9g
  uN3rAVw5jNm8Jx3oT93Q8CmfOvcn837i/r2a70S9v2HvTsV8yvN7t453zzvh9D18KtYd8XZzjdey
  sd/+GeS1/vH7O3N1xkVjdz8fro5fqReunJPqvJ/KAd8ie353591fIU8XnQNn4z539nbl891dNXwb
  veCdnDeeZDyP4/vEyudK4Lv8xvvaZ1z4X3/9Xlj9G8e7+pX9jh6NeUc9u67+DelT68s++67MmY2t
  Pj8/fV95P2eCv3YGdtcb/a0i8+lan5bjZN531/vX7g/4zT79O06W+9N1RZ5WD2Sq+2rl9d3c33iv
  jH8v8HeD/+v02p/Uy/H3mU/XQ80eXTf7G+kndP6eAFuqwza+Fh3G7Pr4/c/P1YGexb8qWx9wr5P3
  2yfu3yc8Lz5Vwx15r8Z8wn78124d7573NKfX8c6+VLnGa9nYb/8MEn2m+vn+zlydcbOe735enF1f
  rReu6pw1Z5G/IHo+r8y9qy6+m7PxnarPcK9j7O//0gvgr/K7FPxdv/H+9hkX2PWuZ8eVv989SVT7
  N6+nsrKu8b+b3VcV8Fv8tWfF7nqjv2tXf/v+Ft9W87vr/bb+ALmnPqefWNfT6oFMdlZXXz+Z++nG
  vxf8pb+tfMKTevm650+qC+4y/g7/yVp+VH9LgC0/B6s6dJ2DOY6t4mfjomuzm2D2WlYfwCrPkLOu
  9vMp+7Fbx7vnPc3pdbyzL1c/N/2Ms5fn48/Gdj5Hzj6XZp83d2uGXb/pOQJXRc9wuMJZ+k7R3wGr
  z3cAAPAb+IwL7HrX8+M3/17+29azY/zvZp+uB+C3GJ+p1d+9v8m31g2w6puf1cAa93ou+n84PlvR
  7/bE/no/5K944t/A////OgIu+PSBBgAAAAAAAAAAAAAAAAAA9n363yvzy3z6QAMAAAAAAAAAAAAA
  AAAAAPs+/e+V+WU+faABAAAAAAAAAAAAAAAAAIB9n/73yvwynz7QAAAAAAAAAAAAAAAAAADAvk//
  e2V+mU9wjcQvAAAQAElEQVQfaAAAAAAAAAAAAAAAAAAAYN+n/70yv8ynDzQAAAAAAAAAAAAAAAAA
  ALDv0/9emV/m0wcaAAAAAAAAAAAAAAAAAADY9+l/r8wv8+kDDQAAAAAAAAAAAAAAAAAA7Pv0v1fm
  l/n0gQYAAAAAAAAAAAAAAAAAAPZ9+t8r88t8+kD/V1XL1Rqfskbgd/BMeRb7waecOnu/5QzfvY6T
  8TufOWdjxrG/ZR8BvtnT/s4BPEP0bPCcAAAAgP/hd+Tr9PD//rcy/QC4z/is9cwFeDbPafg73O+5
  sTd69ffYc/6KJ/6/ab1/VQwbosP2+nX8fjyU0djX16M4Y/7o+yhmZy0r16/dlsCnvPv+fcLz4lM1
  3JH3aswn7Md/7dbx7nlPc3od7+xLlWu8lo39DZ9BXj9Tja/dkaczbjZ25bPkmHv8DDnGW6kDTuie
  +XfVA5+SPcO7c++qi+/mbHyn8fPp7PMdAGS8XwDfxN8jgV3venaM/13lHTnvENX+zes55bfsL/A+
  f+1ZsbvecV71/zV8k2+tG2DVNz+rgTXu9Vz0/3BkY7juSb0c/7+dT9cDd3vi/5sW/R0BjqgO2vj6
  7DBmY1/jVDHefdjvv3XhWT517k/m/cT9+4TnxW/Yu1Mxn7Af/7Vbx7vnPc3pdbyzL1Wu8Vo29ts/
  g7zWP35/Z67OuFnPVz4fro5fqReumJ3313Hvqgk+JXsed+fdWRvfy9n4TrPPcK/XPlvpc+gF8FeN
  z7/X94noK/B7/Mb72mdc4Mfqs+Bdz47qv6mMY95Rz66s7k/UsmKnxt2/s35DP4DP+2vPit31vs7L
  /ub9jb38tprfXe+39QfIffo5neX+dF2Rp9UDmeq+Wnn9ZO6n6/x3t29d2wmn1/6kXr7u+ZPqImaP
  rht/h/9kLT+qvyXA26wcxtexTz3En7yp4RM+ce5P32+fuH+v5jtR76eeWXfkfUI/T9it493zTjh9
  D5+KdUe8bq4x7+zn19efeF91c7zWP35/V76VusY92rE6d7VeuHJOorMXxXYWP88e3G/2XJ7Ne0eN
  P/nelYs14954L7/Xnb3tfF67Y3+/+bx8c+0n/PX1v5t+8yTR+//P1/F94xP18fs5W5/zG3vvdxj4
  X3/9XojWX/XkXf3q/O3uG55lq/29Mvak7LPvypzZ2Gxvs9e6sfmdnAH+2hlYXW/2N+3Kp2rdif+U
  98O75+36a/cH/Gaf/h0ny/3puiJVPU+r9TfR23XVfZW9fqLPd3zuu9vrZ9mfr9k6vmldp51e+zs+
  z6+O/cTZfdqZelo9kW+o8enu+j39ivgvCPBmv+0wfvrGhl275/cT5/70/faJ+/dqvhPzf8Pevcb9
  5PwTrvTmm+7fO3KfXsc7+/Kaa8w7+/n19eraidruGP8z57X+uz9XdeNmdYyvv8vOGvhbVs7Ez9jX
  r6/nKvr59fXz1a/V/Zfpwf06z+Fq3jtq/Mn3DTHv8PQ+f+J9+9PP58y71n4y1mu87HlQvWeequNU
  rHf75tqvGD8z/San1vSX37f4G6L3j9fvf/Nzgmf45Nn66+f6N67/qb9fULNn57kX8n8gHX2+ubNf
  nd/Vx7HfsH9Zf6/Mf4es57M5K7GjvY1yr8Q+VeOnY34yz5OsnkG+y+qe/oUzsHLmx/fp6L17phN7
  te7TOvXeaTfv3T2JXvsL98hvZv++x52fJz/9zHutofv6J1V1vqPWu3M8rd8/nlrXk2U9q14/0ecn
  PFNWRc/DbB2r6/qmPsycXsuTnmfjGbivqjz3Uzytnsg31Ph01XPuU7JnMLzVbzuMn76xYdfu+T15
  7ruxTt9vO/Gu5D9R/4n5n3hm3ZH3asy7erFzpnbquFL/J9+3PvHs+FS8bq4x78/P49coRnXtRG2d
  61fO792fq1bjRuNntX7Cqf68w8l637H2O3JEMXfzjPO6caIzNDtj47ideq/6xjM/OlH/t/eg4xNr
  fM25+7x99xl91zPqid75flJdz65Fz+e7e7ub45N1ncp9+jx0ngeV1fpOn5dP38efzv8pP+u+a/2f
  7OsT79U7Y75Lt/Yrz9Bv7s83en0OvD7Lo5+7seh7Us8+VctveK/4Vu9c/+yz4olaqs+2vMdu7999
  Fp8Q4+7cT74Xot8l35Hn57Xo881d/Rrj/ieRXT9dzylZfSt1n1pfFic7Z+P+j/2fxZqtvbO30bze
  amOzGLP41Zp267lz/G/QOXe/zV9Z539V99PJe+1qTe+0cuaj53T1WvXsjeKu7MGdfZvVm+W/+myu
  zuJKnDtk6/30+X2qK315Z0/t33s97VxEz+7TOVZq+ZbnTFXnTq2rc+7ux9P6/eOpdX3SrCfj9dnn
  jFP326efKTv3VPQ8zNbxtHv2TlfXvhr/dMyV+NWe3+1pZ+Rp9USe+PngLnfdd7Nn3ak8q3OAG1y9
  OX+zJ/XjSbWsuqP2LOYs18laurGie+1q3tV4V/Jfrf/E+k/2cCXO6b07EfMpNe3WcaX+Tz4HT56/
  O/bvZLxuruwzxPg1itF9hp98zp74zPOfidV4WY0rcbM6ZrV+wtX+7Kjy7l47WcOVWD/fn+rvGCOK
  uZunEzuaE52h7lkb+/KOc5jVeGfO1bpW5+zkuRLjna7Ut9PTU6JzvXrmVs/m1XXe0acT+/cOJ3PN
  7rEo1+ysRjHu6s/VZ+OpusZ7aKzvXbmvjM/u/VWr9Z0+L50zfKd353uKn3VX6z+5r+/0qXv1UzFP
  xZ89D7qxq+frbN6T78fOPTOO3b1+p2hPZu8Rnb158t6ddHKdK7Ge/Oz4prw7z7R3+MT71jvXP3uG
  7Ly/ZDmetK9/Qeeeetf7R/e9avc+WfkccJeVe+Wp98JY1x11ZuvPPt/s9itbS/T5acwV5b1azwmd
  vLP+7uTJ4s3mduuo9mQl1mztnb3t1to16/ssXrWm3XruHP8bzM5dNvbKmFN2c50+F58+Z6v3XHQ/
  de6xU3XfsW8rMTvrHp/N2TO1uj6OG+PPnndX1riqqqfK360p68fYx526V+dcib1b52lPqGF0paZ3
  rueJvfvNnnYuomf36RxZzuj1lefMJ89uVec7nt3veP+7K/4VT61rxek1zOJFn7eqeaf2f3Y/3L2X
  O/dU9DzM1vHJe/Ydz5hq7rvP8M6812sr8as9v9vTnm93v8+ciLGyT6vnYL+ye0Q1dV/L4lXPulM9
  6OxR9IwBbpLdeNVNedXpeHe4s8bV2NH4EzHeYTfvz7zxaxVzlutkD7qxxvvsRN537v3V+k/NP9XD
  lTin92435nj2n1LTTh1X6v/kM3m83n3vjOKcPs93nIfOtf8EXsdkcaqaqz53Ymbjq2ud9WXrnfVg
  VZZrtuashqfZ6UnVz+j1n9fGr2PfxmtjjdH3WcxZ7TvzojqqurLaT+XqxO7UGtVbxYvOUPe8VXM6
  9e9YyTeLcWrcWNfpOqo5J3o6y9EZX53FlbjR+Ktr3DmP3Xthlnf1PFxZ62p/T9YTjdtdy6n77lT+
  6OdszOysjedqtaadM1uNz9Z29SyOtY7fZ/t1ah+rONWas5quWl3Ta60n9iNa8+q8k/lPjL1Sz0rs
  E+uuYnTGZPM+2atTMZ9Q2+p+n74XqvxZrtf9X6n/6rOkk2Nlzlh7dj+sPEdPPDNnObrzxjV1VPlP
  9v7U+DucrGEl1t1r/1Rv3503OvPdOVdzdses3FtX7sN39j7r9cpzNXt99qx6upW1PlHn7M7Wcmqt
  1XvVeO+vxMxifUL3efLue+HKs+fUc2vcq6gP0fOi6tfq2R3P2WvcTt5ZPV3dc5LV3pk71h29nsXN
  1p7VGPXxSh3RnlQ1RLVn47I9jF5bqTXrzSxGtq5ZXd06VvPN5v520Vnb7e2Vnq+oztaVON3xs3ug
  G/d0j2b3VfZatG/d8Ss17Iyt6rg6vrPu/zR0x72Oj+JXr3XXf0VW56zmqtZZjiuxorgr46+M3a3z
  tCfWdiX/u+a9s0cn82T7fSr+FbM6rly/Y43jM+f02evsVfXcq+q6+ry84jXfiR7u3LurOVZiv2MN
  O3Oecp9fcXoNs3usut/G12dneKX2k7FWZOvrzOsY8+zWc2X977o/s7nvOMNX5+3s1c/Y2dk9Ibv/
  7sq3484zemKt4z7t5Fx9Pn1yj7r1d/swe86d2v/Z2Y6uV7UBF81uzOpadJOvPhSuOhlrFvdUrqrX
  0Wuvr49715mfxVmpbSarcVZTNHeMMda/W/u7z13Vg9WaOvfq1RzR+J1849wr6+/EWK3nrvF3xdzZ
  jzvXubuvV/fyznO/+uzY3ZNRt75ZzKtxxpjRz2OubD3j16jerOaqz1nMKu5OfdnausbYVZ5qHVXM
  qzV+SlR/1IeVfkX9jvJmr43XZr2t6slqHONmNc/mV+uIvp/1anatGhvNzdaU9TZab7bOK7K+zdY2
  vtaZt5JvJU8UJ4tfze+sZ/V6FrOz9tXezOZ0ejf7vhu/M75bX3fsz+vZOVs5d7Mx4/pmZ211r2e9
  mNW2cp6v7ttu7irX6r5n16Nasl5368zOxs46x7q6ZzRbV2duVWP087ju6lqnzlkdVW+z/a1yXzWr
  L/u5ipOtr3NtFisaV9Xweq3Tg93axno6a+io9mg1T7Tuzpp288zirsbeORtXcl+9fmLOrN7obK/W
  1IkfXe/ec9Hr2ZzOGmZ9qOrpxstqj2Jla53Fyerp2u1TtJbo9Wxsto6dda72oTs+2pMreVdid+bu
  1HHX2JU5V+q/kvdk/OpcZ/OvnpdujvFsvX4dv8/qXz0nJ/tfxYrqzdYVxcrGja9la+qss7NPs/FZ
  jE5vqjlX9vmK1b5FdXbO2aw/nVrHfONZqs5QlSta32r/T+5Xd0+iNZ6oY+eMz8ZemZtdy85C1yxf
  db528ld1d3rQrTsbH61hNV9WdxS32+uxd9n3VY+zGmeqOrNau/mrXmbr7vQzGtftbRa3WvNKvu7c
  zvzV+O/S6UF2NnbiXun5LFeVJxrTqWP3XFS97MbtnOFVq2ud3WPV+FkPOrV27rNozO46xxjR2YnO
  1szK2Fn8rL7ZGqvXu6o6q3FRnVf6s7OO1bmrY6/Mv1OntnfW2dmH3WuzvKvj7+jL3Wcli78T40qs
  nbnRmXztzTg/GrOqqvPEcyerL7sHV9ZY1XWiN7uqfdypJetJNX7nzHfmnFrDyZqu5Hia02uo7o3o
  enQfdp8Dq3t1Mtbq2GrO7P6trNY01tOprxvzrjnZmbmSfyVfN0dV185e/Yydnd0TotrvzLfjyr07
  G3NireM+7eRcXeOVnlyVPbdWa+k+5049o2ZnO8sN3CS7MaNx0dhq7uxGjx4SswdJlGs2N4vVrS+q
  YSXvrOZsbVGuaE+yuFnN1fyxlmifsj2PaqzGRmOia1ltKzV1x3R15lV71YnTXeds/mr+2f51XV1/
  N8aJWqo+dGtdqWN1zur8lXO+25fds5vN7ZyFzvjx3Gdfu7Gienf3JDKb14m1E6OKHf085srWU9VW
  1fz6erZXWfzoNUEpBAAAEABJREFU506NVf5d2VpW19Wt95t0z0J0NrLXxxhZ3uy17PysrGVWexUj
  i7vyehZvnJP1Mrs2xsjGVGuqerDSqyuqfmbrnfUgiruy1k6eqDdRHeP4av6Yp5o7qzurZ8xX9XuM
  UcXPas7qj+qIehDlq2ru1N6tr5qf7U3V51nfs7lRzvF6FDObu7KecW2dvkTrnK07Wn9VX7WOWV+y
  XN31zXJHtUQ9GWNm+aMeVn3M+lGtqVNnFbM7NxPF6aw/yzlb0/h1nFetuepDVe+uKGZVbxVn1v9q
  zd1YUcxs3koPst5W64h6WH1fvbayzijnytxujGxMt9dV3E7sqP5qvVV90ZpW+rdzPRq/uobOWdrZ
  17EP0b7NYmY5sjnR+rM6OrVncbI5Vb2z16v6ZmutenpFZ82zdWT9z1T92Fnnah+y3mfjZtdX68nW
  m82N+hv9XOXr1rayjpU5VQ07ecb5V2PMaolqzs71yRrHve7kiM7JGCMam+3Rzto6a+32OltjtY5x
  7WPsbM2zfqysq7u+aHz2WrUv0T50Yow9ma2vWtOs79VrWe/Ha1UNVZ7uHmbnYPZztoYob2c9V9aw
  EnM2JtuPu/KvxL5SV/csRedhRRQzynVXvixvVtNO3VGMqMed+lbjZjGyNc2+j36e1TiTrStb407s
  Kl7nWtSrbN/+DaI1ZvOi+Nn1bGxmVnt3zmz8zrVVs57/vD7W3+1tlmO1H7P6xpjV91XcbF8768nG
  v47Nrmc9PrnXnRqi8eO1Ti+jPNEau7V2aqzm7cbI1hGNqbxjfLb+7PuucX5WZ9W/lTE7a87qzfJ1
  170y9mq+Wbzd8a/Xsh7u1rlT26wv0bWx1k6eTh3V2Lt6Up2V3RhVf2b9rOJnte7UOKszu/5af3Ru
  Z6+v1hnl2z0PWX1ZzVGeToxqj7N4ndpnY7M9rOpf7WGUp9rfqoezHCfHdWq9K1f282lZ/6/kPlXz
  WEd2Hqp7avx5doZX9+pkrO6cztioP1kfor7Mzm0Wf8zTXUv39Z1Y0ZjozHRjnaqt06Oqruz7Ti0r
  e9SJ13n9VL4q56k4V87uSozZnOi+XM25usbuPXKH6rlS1RI9e2ay2N06x1qrfma5gZtkN2Y0rrqp
  x1hRzCpG92ES1ZmNz8ZU+ao1V/2qclX5x7hVPdWeRLmymqteVmOq9UfzqjzR2Nl6O/PG+FEfq73p
  mM2L6uzGidaRrblT5xinEyvrexQryznG6V6vaumutxunWtfO2ju1rOxfVudqL7o9ruLs7FsUo5ob
  7UFWY2cvo7xRnuy1bK2zn2dxZn3oiGLsxopiRz9Xa+iur6o5er2aX+Vbre/K/G7sKM/Kun6D6jxF
  5yD6eadv1dhTZzs7z6t1ZXM7r2dnbLwe7UN2bVxbVcvs2krtJ1W9q85iZ72dPGPMLP7Yj3FcZy3j
  vkVrjGLOehHNy2qfydbU7U00Nlt7p4asv1WdWbysjmq93RhRzmx9K+usxnX7Uq25Ws+sL2O8bM3Z
  ema9y2pdzR/1ZVZblK+qf+xVVUu2lpU6qzqqfqz0rKpzVluVL6uhij2rs1tPFTP6udOjcfxqvZ24
  Y8yxrk6ts76v7HGU63X+WFs1r6vat6wfszjj99Vrs7GzPN1+zWJkuas6q55GMcf8nd5FMbuvzXqQ
  rbk7ZpZ3Vtssx2zcSv+zuqN542tRr7Pvo5hZ3mhO1otsbVWNVa5ZX2frieqLvq/qGcdXr2V5Z/Vn
  +VfN+hpdz+qv1litazZm7M2Yb2deVG9Vyzgm6tVKf6K8VR+z9WV5qp+ruLN+VvGjuqu51fqrGqp+
  zvJnY1Z6EtVe5cn2fEVVZxS308fO+rP8q2ua9bUTJ9uPak2d3NW6shjda901R/VW66uuZ2sbr1ev
  zdaQ5c/mZf2q1hjFy/pX/ZzlzcbM6uqsIetR9FoUI5vXiVnVPstX1RGNqb6franKE/18SlbfmOtE
  7ixG1oPxeufnWY7XMbM5s9q79Ub57+jvKdmZuBIni1flyvrV6V9V72wt/wZRnVG8cV7nfHTmdMZG
  /Rlrn82P4s1ez9bUXW/U2yjHOKa7ntkasv2f5crqi77ujB9ri2rKejzrTTamqreqMYsdzcvyzvah
  qne2/tlaozyd9We9r9adrfVTZmvJ+pd5nTN+H73W7c2p3lV1j9e7c2dxZr26kq+KN7tW5Xl9Pavr
  9ecrdUf1Vb3J1lHF6Kxzp65ujVet7l8nRtWfWT+rGLNxnRid69mZHK9F5zRa41j/ynqiuKvnIZsf
  rTeTjY1qzeZUvemsoVpzdi3Ll9XZrSX6ucq/mqdaT7SOnVq76+3W1M3dnb+q069q3MraVmup9q2q
  bTw//0lUNayct6t7lK3rSt4oZtaHSrSWqLdZ/M5arrwe5e7ky+LM8s+urczZqTfq+2pNs31ajbuy
  Vzu9W8m5Onb1/FVjruzJLGa27+O82X6uvB6tZ3UPu+d7zJHVUX29Iqqrqj3rTbSuLN/VmoEF2Q1Z
  3aivYzqvRTFnD8BoXjS3Ez+KU+XKfs7mZrWMX8c5VcxZ/2Z1z+J0f56tc1br2IdVK/myGmf7Fe1B
  FScbPxs7q6la7yz3OH8lXnV9jBXNm62vur47ZmW9VYzu+KwH1bUsZtXTbB2znGPcak6nL7NeZvNW
  5mbrnPUtij2LV/UuqznrWbSerMdZjStOxsrij7k66+jUNL5e5Rqvd2tYrTWr67Qo7sq6foNqrbMz
  l53VT4pqeef56Yyp7q1oXDWmU8vK+t/Rtyp2do46PVjJ85qrswfj+JU+vcbP7pWV+2esOYrVqavK
  X8Ufx1S5V2rJ9iLagyxftaZOjqyX1Rpn47vr7NTfHRudke712TmI4mU1raxppb7RTh2zurIxVa86
  tWT9reZlMbL9yeZ0ahzHVzFXa4zmzeLMau2OXcnf7dM4dqXeTtxZXZ28495n6+/s8er82Xo6qn1b
  3adunqhf3Xzj/lT9ymJFY7K9n43L4o9zsjVEuTrjotqquqsaqzqrMVGu2fjsevZaNTczxuz0cdav
  qMasb1muTh1V/6paorlVrmhOVevs9WytVT1RTbM9z9ac1VbVu6ITJ1tP1dux/myd2fgxTzYny5vN
  i+rO1pb1IaujU1cWMxtXra3bs6oX1ZgqX1bTrNZoflVLliOKlfUxWnvVq1lPqv7N6tq1svbO2qI4
  VY5o/phvZy0rZmvIasz2dGUNVe+rvkR5s/nRz909z3LM9jPqX7a/2dqr9c/qzmrvzKvi7V6v1hjt
  SzWmE/M1VrZHK2uY9bCK36kjGpN9n9XxL9Cp75TZ2qJxJ3KNr6/Gz+rr5NhZWzSmOlfVa9n1WQ3v
  cue5Wznj1X7N+lfVPFtPdD9mNY91ZrL6u+OzuqJ+jDVHY6P1Veue5czyzdab1TfredaXWc5ofmWl
  7u7aO+M7tWV5onqzHmXrzGJGNc5qjtbcWWfVmyxmNHaWs6o7upbl6qw7W+unZD0er4/9W93LLGe3
  Nyd7l61lvNadO4uT9S36WuVajRvFzvJl66h6uNLfqv5xXhSnW2uWr8qdvVbVUdUw68OOKudOjKjn
  49eqn1nM2bjVnOPr49hqHdGY7PvO3GodUdwsRqaztplsbNTPTt1jbVG9WexsjdW8qhezGGNNVcws
  R7bmnfVEOaIYUfzZ+rM4nZqq11/nVjVV+Wc6/arGRXV1a8rWlNWR9SOrITtTWd3R3Fn91diVPnR7
  nuWNzs1s/R1V/Oz7WV+iONG1lXWv5KzWU+XvXFuZs1Nv1PfV+LN9msXNcsx6WNVT5ZjlrcbMxmZr
  reqs+hbFWFlfFGPscae2bI0rr89qma2jypHVEJ2n/wyi+OOYVVmsbN2d61VdJ2oGFkQPstdrs7m7
  c8YHXTV39sDJ4ldjsuuzh10Uu8q1Gmsnxrus1nnyTag7rnsmszNVnZ9/iW68qobZOrO8Y60r/arG
  RjFX9jSrb7w+i53tyezrbC1RnbOcrz/P9iLKM47L4s3qmtU3zovGjWOr3nbWkcXI8nVl/a3GRz9X
  Pc5qXu1Zd31jLVltnXjV3FmO2do7a6lqil7v5IrqnOXbrfVOWV1PrfcO1VpXzvfZqvY9qZaObo/v
  zhGNvbOXu+dutaZZrNXnWPaMvFrLSszoveRKvCrOavzsvWP1nHe+n8WNap/F7cSv1nTyPfHKWY/O
  SLWPs/vgylqviur7N5jNn702OytZzupsVmsZ51zZ66z+We6dOqsasuuzNb7zHHVfX+lVJ8eO7nnq
  jKnulyrGzn1ypdaV+bv3zix+1a/VPZn168o9O8vTqbN7T3Rr7txL3bo7/Y/2qRsvGp/t+1jrSs3Z
  uE4PsvircVfid2voxI56na0h6ne0llPGmqLrVU1RjdXXaP5J3b0bf56d2dnrV3vSjTWLHdU3O2sr
  +arXsrnd/c7W9Roj+rkzJ/ta7cEYO4o/60OWI5rf7VM2PutVdC2Kka1vta7V+js5qrWNY8b43RxR
  bd2xOz0a11PljV6f7U+npupMXImbjc++z+qqapjVV8XIrkV7Uq1nlr87pxNv53r3fGRnoBszO8tj
  jtWeRjG7dWVzsvqz72fz/wVmcU/q9vh0rvH1U3lXz8jsWidX54xU45/mzjOxcsZXzsvpno73Y+f8
  vH7N7umx/mhstrbselZfVHu1t1ENY+4qZ9arar2zmrrri9YSrWsWszKru1tnZ/xubVGtUc+r+qPv
  s/VEfemM31lnlada/2x+VXe1/k6M1THvFvVidkZev8/O1m7+dxhrjs5Id+7Pa69fo1izs1edqSxO
  p9YxdjY+ylVZ6VG3/k7eKEZ2bVxPlTeal8V8vV71K+tDR7WWbv3RerJ1jGNma49yRTHGuVHe7Oes
  1lm86Ho1Jhvfqbk793V8ZjZvJcfOtdmcqN7ZnmRrzNYdxc7qzOLP5lXrzdYcXcvmrtYc9TeruRsr
  uj7r2Ti3qqmzhux6VVvW485rVe6sxijW+DWrbawn2u/oWhWjU381tsqTjYvW1ckb7cEJWY3RuGr+
  rM5qXBS7qmnWu6yOKn/3WjY+W2OnR9nXaNxK3qz/UR+rfkZxshjVejt9zfa+OzYbU32frbW7J9Wa
  sxxRzmotVV+qtWRrH/NGtczGVuvM1pL1d/baXVbzZ/uxEgO4QfaQ+bm2E293fLeOqubOmNWHayd2
  d95Knd/s1Lq6Mao3mM5r2ZtwNKZT2xivc15n10fR3JV+dep/jbmyn2NN3fVVsap9XF1LVGc2vup1
  Vvcszxi/2+uons7+R3XO5s16E8Xo7NUVuzH+DV5jrZ6N7PtubWMtUf7dWFn88dqYp7P2rqwXO2va
  reEJsvq/fV0rrq71N5yDT3pa73aecVfznLq2O371ubdTx+6cWR0n8905/ur71W7O7llaeS84sY93
  3FvZZ4RZrs64u/rQkX3euHIf7Kxn9rnnnc/y3f04WePqufr0e93qPf7UenfGVGf36nO/O/9qP+/e
  j9dzmvVsdU+y59ZKTfqZg4QAABAASURBVJ1zu3NeP/Us69bd6d3sbFdzq3pm98kn+rZqp5bT9Wd9
  7DyHrtw3q7V193P1/u/OOWF3v2f3zqw31XrHMVfvm86edWKf3O9q7pV1jfPHvarmXDm3Vd3/BrN4
  nbNxQnXOOj2J1n6yvqze7tixrtlZu6vPp6yc0ej1zvnr1nHn+J04s/trdq0zZtbTlb1Yub7qSrzu
  Gdm5F1fnz/a7er0bP7rnZ8+JqpaVeyzK9+5n0N05du7HUzlOz5nFy54Pd+Q7bfcM78SvXl95ht7R
  087zPLo2zuk8Q6o+v8bZ6cnq82r3uVOtd8yRjd99ZnbmXD0js329EnN87UStozFf9H3nzEd9WDmb
  q/vWEZ3bKO9qvmx/9it9lupeHX+uvj+5l3fL7o3Xa925nVwrP0fXxntytYZOvmxvV+NkNWb1d2NW
  8bNr0bqieVmd4/Ws1qqnXVmeKGaWP1pXNW+Wo1pf1ats3CxmNK87t7sfVc6Z7tqq+dX+r+TeHbva
  m+h8RntfnZFsnbPXOntf1dRZ38xY42y/ZrmjWGN/s1jZ9U6Po7FRjNm6spzV61W+bi3Za9las7qq
  tUZ1ZGOy69XrY42z69laqrFZnirO2JMoTrbGai27rsaM1lqtubPeLMZ4LduTrF+zfYquVeNm8bOa
  o/jR106vq9ezubOaZuuoYnT6MK6927dobNWHqM4qZta3WQ+q11ZiRNdP1lX1OKu9yhvFreruvvZp
  s315Zy1A0+mb846bvfPGEc3pjOm81p27O+e3PiDfua7qg0N3fucDRvVzFG+nlk59V2N31rqy3mj+
  Tk2r1zt5qr5lMaMPat35nXG7+7h6RmexVudV/Th5Pqv8u/NW93LlPK72PapnR3ROZ+c3qvvkfmXr
  Wj1jd52hT/ut64r8pbUy967zcOo98u5adsbdNX81zmq+O/v+7rX/jO2es6eeuRMxT+T69PtE9nml
  U9ep++WOz2K7dj+/faL2p/TtzvvjycbfN07Eu17Vs/P+G6zOHeNk17t1rOa9Y/wp3ffdTu9OnOto
  v2bP1294luzU8o76u7179/1+ctwn7O5393PPTr7unt7Z/5XPSifP4NVn9zi/86zbfc9a0Y0/e37f
  UWPWo+4ZuLt3Ve7Z2Nev0fqy3j71mXXl2fDUNZ2w+zzujsvO+M7zfLe2d7jz+bKa58r71u6zNpq7
  +p509az9Be96z3inb17P3bV336c+3cPd/J1n/M5zZfc+qea8+3NOJ9/qM/Nd5+Rd5/PE8/A1Rtbz
  6PvuOYx+ftJ9feo9pfOZ4JutrKU6O9/Uk38vfn5+vbY6fzZ25edZjKvPvKvP3O74f4Ho9ZWcWezs
  2ljnLPfu+a562ulBlnfWg/H7qBezMZ31ZL3Kerxaf3X9Sj9Oy87ayvzsPNxZZ/fabHx2Zqu51djo
  2ix2Z/zJfq7enyvXo3NQ5cquZ/OzHJ3YWd1jrmwN0bUsTnStU1+11mzd0bwqXjWmGyercXY96ms1
  tspTje2uq7vGq6r+rMzP9j8adzV3tk9R/ihftk/RtWruLH5W8xi/ijnGqPpY9TK6XuWv1jHmXu1D
  tvZZ37L1j2NnZjk781fy79Q629PO3ozjVuPNxmV7vxvvG3xbvcCmd9zs3TehzhvGlRp2594Z60m+
  aV2zDw8/Y6qfo3gn65vlXI23stad+E+Z87rW7h5mH3h3+/LEe2FnXSc+EF9x8lx+4oy/zj3RryjG
  7Mxe+eVjt6bVHKefn8Dfcednm7t88v3ojjjv9Im13zX2hDvy3bmGJ56537Bnu7LPlZ+oZeYpdT2l
  jnc7/Vn9U318Z97qbxKduVGc6PpKHSt57xh/ysn1nP79uIr3bc+PnXo/ucZv6+/T7O73N31uvPtM
  X3lWX8mbzf/me+KT9X9y307n+OYzUOnea7/hvXjFbG13PVd+c0/vtPI59XTc1bGeO3CPp90vu/Xs
  vv/c/b4185TPbXf9veaqk7/brObamT/7jNL5vlNb9Tefzvw7PO1Z8tt9U7+v/l7970Vn7JXr45jV
  e20n3yn/BtHrJ+NGsbO8s2fjCdUz9bW+lWdvN1+Wfyd+1qusx7sxr3jHuc7O2sr8aN/feU9etXLv
  zsZW928Vs/o5e23Xzh53r6/uf+e51b3e6ePserS/0bmu6stq29nnf4lZDZ3aZnO7On3u7tFsbNWf
  1bqujn9n7NkZzMZGP1/JneWv8mXnt1PrylmIxld9q3qyetZm82a1zeJkPa/6UK09Gj/mnY3tmvWs
  mnfi9U5tV3NFe3WyxqtxdvIC/Aq7b0JRnE/M/Su+qUedM1V9UJiNveqbevlfJz8kXp3T/UAXzXnC
  s+YuVz5kn4r3V53q1dV7ZvYL4smaVnI4SwDv95efvXe9R/2Gnt65hif254k1vcs3rf2bav2Nfkv/
  37mOd/y+9Yla3hH3m1W/b/+Ffv2FNfK/Tv39tIr/5Hh3xv+tf5fuuvts3eUba/4N/trv67tOfJ78
  q59v7vCEz+er/90UOOu33Fuzdeyu87f0Z+ap63xqXZFOrdH/J3F3TniCd/1N+fR7wR3/P9NdXn9P
  Guu98reNf4PsWpT3U7I6xjXc/feznfh3/K57el8+sc879+63/91g5b7N7tHX61fiZzFOO1nP1Xv9
  6pzqebyaN4rVybVaW/e11/nV2Vs5j6d1cnTfu6qzFK19pyed3E/zusZZL1fvg27+8fvqHunsXfR6
  9HO2htX7t9u/ag3Z+JWaxnu6k7/q3UrOTv2rc1Zirs47kb+To3svzV5/l0/nB4CjvumNbfeDTRXv
  VKw74v0lsw/f3bnoxyknfyF7UpxTsZwzgPf7y8/elbX/tT5Z79/xl9fOmt9yVn7LOlbdte6/2s+K
  nvCXnP67ehT/yfHu9E213uFb1/+tdfM3+DwIwCfsvk/8lfeXp67zqXVFvqlWeLer98en7q/T/+Dl
  TrN/oHPlfTCL++/FlRzvcvffD6N8J+Y8va/vsPP/2n57L1fO687ZXp3ztN7N6nm9/q7aO3lW6u6+
  trP3u7nG+eP7wCzWu6zsxZX7oFr703py2soZzM7QHbVk17t7F8XrrrV7LTt7u7ErO/d0J041rsq5
  et+9xjt1bp58H57c53f6dH4AOOqb3tiqD3BP8OTanu5K7/SdJ/utv9g9rR6Av8CzF/72ffCX1w5w
  B89V/po7z7z76e+y9/9f+3aw2yAMAwD0//966qFStQ2ahCTY+L3j1oDtgIsqDADwDFlf5N2lSp4r
  qSGs4/5qs2pw6WxQasVg0FOoxzy9tXxC7XtyGHnnvHdNtJp+i+eOeGecc+QYo/fH2ZBoz/mO1tx5
  zYzkMXLcir3p7TOX3vtxdx3+63c9PbAn15ZjjHxm1+8ZIzVp+d/oNTDy/dZyzJnHmylybGeyxg0A
  jxD5izhybMA9ZvUF/QUAoPYzUeXcAVbQVwGu00sBAJ7Bc9059blODWEd91ebFYNLn2uPhrfsD6tV
  HPLsyWHkPuxdE62m0eJ5mRFTxLy+yRjzLBV701u2AfSWv7Wsv2sPo107mQfQI8uaa9a4AQAAAADS
  qvzDbOXcAVbQVwGu00sBAKjAcy8QmR51r6P6VxsKgp1WD4cbQJ8vYkw7VM37pfIA+qfodbg6gD5j
  3VXRrp2rex4tnyiy1iVr3AAAAAAAAAAAAABAAy8MA3DkbAB9dyzAX6MD6KvPsVK0eKgp+300S/Q6
  PKHu2XPIHj8AAAAAAAAAAAAAAADwiwF0iG3HADrALPpPPfYcAAAAAAAAAAAAAAAAADYy2AdkomfV
  Y88BAAAAAAAAAAAAAAAAAIB/GUaux54DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAADHNib9AAAAXUlEQVQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  APH8AGR/8vQdL65BAAAAAElFTkSuQmCC`;

  const waveformDisplayTestStyle = css({
    display: 'flex',
    flexDirection: 'column',
    position: "absolute" as "absolute",
    justifyContent: 'center',
    ...(images.length <= 0) && {alignItems: 'center'},  // Only center during loading
    width: '100%',
    height: '230px',
    paddingTop: '10px',
  });

  // When the URLs to the videos are fetched, generate waveforms
  useEffect( () => {
    
  }, [dispatch, videoURLStatus, videoURLs]);


  const renderImages = () => {
    if (images.length > 0) {
      return (
        images.map((image, index) =>
          <img key={index} alt='Waveform' src={image ? image : ""} css={{minHeight: 0}}></img>
        )
      );
    } else if (waveformWorkerError) {
      return (
        // Display a flatline
        <div css={{width: '100%'}}><hr/></div>
      );
    }
    else {
      return (
        <>
          <FontAwesomeIcon icon={faSpinner} spin size="3x"/>
          <div>{t("timeline.generateWaveform-text")}</div>
        </>
      );
    }
  }

  return (
  <div css={waveformDisplayTestStyle}>
    {renderImages()}
  </div>
  );
}

export default Timeline;
