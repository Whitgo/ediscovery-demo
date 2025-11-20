import React, { useState } from "react";
import { apiPost, setToken } from "../utils/api";

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await apiPost("/auth/login", { email, password });
      setToken(res.token);
      if (onLogin) onLogin(res.user);
    } catch (err) {
      setError(
        err.message?.includes("401") 
          ? "Invalid email or password."
          : "Login failed. Please try again."
      );
    }
    setPending(false);
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="my-8 mx-auto max-w-md shadow-lg rounded-xl p-8"
    >
      <h2 className="text-center mb-4 text-2xl font-semibold">Sign In</h2>
      <div>
        <label className="block mb-1 font-medium">Email</label>
        <input
          className="w-full px-3 py-2.5 mb-4 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          type="email"
          value={email}
          autoFocus
          autoComplete="username"
          onChange={e=>setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block mb-1 font-medium">Password</label>
        <input
          className="w-full px-3 py-2.5 mb-4 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={e=>setPassword(e.target.value)}
          required
        />
      </div>
      <button 
        type="submit"
        disabled={pending}
        className="w-full font-bold rounded-lg bg-blue-600 text-white py-3.5 text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Logging in..." : "Sign In"}
      </button>
      {error && (
        <div className="text-red-600 mt-4 text-center">
          {error}
        </div>
      )}
      <div className="text-sm text-gray-500 mt-6 text-center">
        <strong>Demo accounts:</strong><br/>
        alice@demo.com, bob@demo.com, sandra@demo.com, victor@demo.com<br/>
        <strong>Password:</strong> demo123
      </div>
    </form>
  );
}