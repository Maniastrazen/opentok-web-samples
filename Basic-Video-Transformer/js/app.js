import {
  MediaProcessorConnector,
  MediaProcessor,
} from "../node_modules/@vonage/media-processor/dist/media-processor.es.js";
import { WorkerMediaProcessor } from "./media-processor-helper-worker.js";
// import { GreyScaleTransformer } from './transformer.js';
/* global OT API_KEY TOKEN SESSION_ID SAMPLE_SERVER_BASE_URL */
/* global LouReedTransformer MediaProcessor MediaProcessorConnector */

let thread = "main";

let apiKey;
let sessionId;
let token;

const addListeners = () => {
  const mainThread = document.querySelector("#main");
  const workerThread = document.querySelector("#worker");

  const changeThread = async () => {
    thread = mainThread.checked ? mainThread.value : workerThread.value;
    await transform();
  };

  mainThread.addEventListener("change", () => changeThread);
  workerThread.addEventListener("change", () => changeThread);
};

const initializeSession = async() => {
  const session = OT.initSession(apiKey, sessionId);

  // Subscribe to a newly created stream
  session.on("streamCreated", (event) => {
    const subscriberOptions = {
      insertMode: "append",
      width: "100%",
      height: "100%",
    };
    session.subscribe(
      event.stream,
      "subscriber",
      subscriberOptions,
      handleError
    );
  });
  session.on("sessionDisconnected", (event) => {
    console.log("You were disconnected from the session.", event.reason);
  });

  // initialize the publisher
  const publisherOptions = {
    insertMode: "append",
    width: "100%",
    height: "100%",
  };
  const publisher = await OT.initPublisher(
    "publisher",
    publisherOptions,
    (error) => {
      if (error) {
        console.warn(error);
      }
    }
  );

  const transform = async () => {
    let mediaProcessorConnector;
    const mainThreadTransform = () => {
      const transformer = new LouReedTransformer();
      const transformers = [transformer];
      const mediaProcessor = new MediaProcessor();
      mediaProcessor.setTransformers(transformers);
      mediaProcessorConnector = new MediaProcessorConnector(mediaProcessor);
    };

    const workerThreadTransform = () => {
      const mediaProcessor = new WorkerMediaProcessor();
      mediaProcessorConnector = new MediaProcessorConnector(mediaProcessor);
    };

    if (OT.hasMediaProcessorSupport()) {
      console.log("thread: ", thread);
      if (thread === "main") {
        workerThreadTransform();
      } else if (thread === "worker") {
        mainThreadTransform();
      }
      publisher
        .setVideoMediaProcessorConnector(mediaProcessorConnector)
        .then(() => {
          console.log("set connector");
        })
        .catch((e) => {
          console.log("erroring");
          throw e;
        });
    }
  };

  const handleError = async (error) => {
    if (error) {
      console.error(error);
    }
    if (OT.hasMediaProcessorSupport()) {
      console.log("after setting mediaProcessorConnector");
    }
  }
  // Connect to the session
  session.connect(token, async (error) => {
    if (error) {
      await handleError(error);
    } else {
      // If the connection is successful, publish the publisher to the session
      session.publish(publisher, transform);
    }
  });
}

// See the config.js file.
if (API_KEY && TOKEN && SESSION_ID) {
  apiKey = API_KEY;
  sessionId = SESSION_ID;
  token = TOKEN;
  addListeners();
  initializeSession();
} else if (SAMPLE_SERVER_BASE_URL) {
  // Make an Ajax request to get the OpenTok API key, session ID, and token from the server
  fetch(SAMPLE_SERVER_BASE_URL + "/session")
    .then(function fetch(res) {
      return res.json();
    })
    .then(function fetchJson(json) {
      apiKey = json.apiKey;
      sessionId = json.sessionId;
      token = json.token;
    })
    .then(() => {
      initializeSession();
    })
    .catch(function catchErr(error) {
      handleError(error);
      // alert('Failed to get opentok sessionId and token. Make sure you have updated the config.js file.');
    });
}
