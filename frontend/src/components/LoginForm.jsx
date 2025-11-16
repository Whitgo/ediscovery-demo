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
      style={{
        margin: "2em auto",
        maxWidth: 380,
        boxShadow: "0 2px 12px #c8ddfd60",
        borderRadius: 10,
        padding: "2em"
      }}
    >
      <h2 style={{textAlign:"center", marginBottom:"1em"}}>Sign In</h2>
      <div>
        <label>Email</label>
        <input
          style={{width:"100%", padding:"0.7em", margin:"0.2em 0 1em 0", borderRadius:6, border:"1px solid #bbb"}}
          type="email"
          value={email}
          autoFocus
          autoComplete="username"
          onChange={e=>setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Password</label>
        <input
          style={{width:"100%", padding:"0.7em", margin:"0.2em 0 1em 0", borderRadius:6, border:"1px solid #bbb"}}
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
        style={{
          width:"100%", fontWeight:"bold", borderRadius: 8,
          background:"#2166e8", color:"#fff", padding: "0.9em", fontSize:"1.12em"
        }}
      >
        {pending ? "Logging in..." : "Sign In"}
      </button>
      {error && (
        <div style={{ color: "#c71515", marginTop: "1em", textAlign:"center" }}>
          {error}
        </div>
      )}
      <div style={{ fontSize: "0.96em", color: "#999", marginTop: "1.5em", textAlign:"center" }}>
        <b>Demo accounts:</b><br/>
        alice@demo.com, bob@demo.com, sandra@demo.com, victor@demo.com<br/>
        <b>Password:</b> demo123
      </div>
    </form>
  );
}