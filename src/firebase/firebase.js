import React, { createContext } from 'react'
import firebaseConfig from './firebaseConfig';
import app from 'firebase/app'
import 'firebase/database';

const FirebaseContext = createContext(null);
export { FirebaseContext };

const firebaseApp = ({ children }) => {
  let firebase = {
    app: null,
    database: null
  }

  if (!app.apps.length) {
    app.initializeApp(firebaseConfig);
    firebase = {
      app: app,
      database: app.database(),
    }
  }

  return (
    <FirebaseContext.Provider value={firebase}>
      {children}
    </FirebaseContext.Provider>
  )
}

export default firebaseApp;
