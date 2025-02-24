import React from "react";
import { useNavigate } from "react-router-dom";

const TestPage = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Test Page</h1>
      <p>This is a test page</p>
      <button onClick={() => navigate("/")}>Turbine</button>
    </div>
  );
};

export default TestPage;
