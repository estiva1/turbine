import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TurbineRenderer from "./WindTurbine/WindTurbine";
import TestPage from "./TestPage/test-page.component";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<TurbineRenderer />} />
        <Route path='/test' element={<TestPage />} />
      </Routes>
    </Router>
  );
};

export default App;
