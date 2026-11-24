import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Login from "../components/Login";

describe("Login", () => {
  it("renders login form", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  it("uses an email input", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    // Basic smoke test - form renders without crash
    expect(document.querySelector("input[type='email']")).toBeInTheDocument();
  });
});
