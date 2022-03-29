import './App.css';
import { assign, createMachine } from "xstate";
import { useMachine } from '@xstate/react';
import { inspect } from '@xstate/inspect';

const artworkMachine = createMachine({
  id: "artwork",
  context: {
    objectIDs: null,
    selected: null,
  },
  initial: "initializing",
  states: {
    initializing: {
      invoke: {
        src: "initializingService",
        onDone: {
          target: "randomizing",
          actions: assign({
            objectIDs: (_, event) => event.data
          }),
        },
        onError: {
          target: "initError",
        }
      }
    },
    initError: {
      on: {
        RETRY: { target: "initializing" }
      }
    },
    randomizing: {
      invoke: {
        src: "randomizingService",
        onDone: {
          target: "displaying",
          actions: assign({
            selected: (_, event) => event.data
          }),
        },
        onError: {
          target: "randError",
        }
      }
    },
    randError: {
      after: {
        5000: { target: "randomizing" }
      }
    },
    displaying: {
      on: {
        SHOW_DETAILS: { target: "detailsOpen"},
      },
      after: {
        10000: { target: "randomizing" },
      }
    },
    detailsOpen: {
      on: {
        CLOSE_DETAILS: { target: "displaying" }
      }
    },
  },
});

inspect({ iframe: false });

const fetchObjects = async () => {
  return fetch("https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=nature")
    .then((response) => response.json())
    .then((data) => data.objectIDs)
};

const randAndFetchObject = async (objectIDs) => {
  const randID = Math.floor(Math.random() * objectIDs.length);
  return fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectIDs[randID]}`)
    .then((response) => response.json())
    .then((data) => (data.primaryImageSmall?.length === 0) ? randAndFetchObject(objectIDs) : data)
}

const ArtDisplay = ({ send, state }) => {
  return (
    <div>
      <div><button onClick={ () => send("SHOW_DETAILS") }>Show Details</button></div>
      <img src={state.context.selected.primaryImageSmall} />
    </div>
  )
};

const Details = ({ send, state }) => {
  const { context: { selected : { title, objectName, culture, period, artistDisplayName, objectWikidata_URL } } } = state;
  return (
    <div>
      <div><button onClick={ () => send("CLOSE_DETAILS") }>Close Details</button></div>
      <p>Title: {title}</p>
      { objectName && <p>Type of object: {objectName}</p> }
      { culture && <p>Culture: {culture}</p> }
      { period && <p>Period: {period}</p> }
      { artistDisplayName && <p>Artist: {artistDisplayName}</p> }
      { objectWikidata_URL && <p><a href={objectWikidata_URL}>More info</a></p>}
    </div>
  )
};

const InitError = ({ send }) => {
  return (
    <div>
      <p>Error initializing</p>
      <button onClick={ () => send("RETRY") }>Try again</button>
    </div>
  )
};

const RandError = () => {
  return (
    <div>
      <p>Error randomizing. Will refresh soon...</p>
    </div>
  )
};


const App = () => {
  
  const [state, send] = useMachine(artworkMachine, { 
    devTools: true,
    services: {
      initializingService: (context, event) => fetchObjects(),
      randomizingService: (context, event) => randAndFetchObject(context.objectIDs),
    }
  });

  return (
    <div className="App">
      <p>State: {state.value}</p>
      {state.matches("displaying") ? (
        <ArtDisplay send={send} state={state}/>
      ) : state.matches("detailsOpen") ? (
        <Details send={send} state={state}/>
      ) : state.matches("initError") ? (
        <InitError send={send}/>
      ) : state.matches("randError") ? (
        <RandError/>
      ) : null}
    </div>
  );
}

export default App;
