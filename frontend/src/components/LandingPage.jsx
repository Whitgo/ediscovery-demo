import React from "react";

export default function LandingPage({ onGetStarted }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Hero Section */}
      <section style={{
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        color: "#fff",
        padding: "80px 20px 100px",
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h1 style={{
            fontSize: "3.5em",
            fontWeight: "800",
            margin: "0 0 20px",
            lineHeight: "1.2",
            letterSpacing: "-1px"
          }}>
            Streamline Your Legal Case Management
          </h1>
          <p style={{
            fontSize: "1.4em",
            margin: "0 auto 40px",
            maxWidth: "700px",
            lineHeight: "1.5",
            opacity: 0.95,
            fontWeight: "300"
          }}>
            Powerful eDiscovery platform designed for modern legal teams. 
            Manage cases, organize documents, and collaborate seamlessly—all in one place.
          </p>
          <button
            onClick={onGetStarted}
            style={{
              background: "#fff",
              color: "#1e3c72",
              border: "none",
              padding: "18px 48px",
              fontSize: "1.2em",
              fontWeight: "700",
              borderRadius: "50px",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease",
              marginTop: "10px"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
            }}
          >
            Get Started Free →
          </button>
        </div>
      </section>

      {/* What Separates Us Section */}
      <section style={{
        padding: "80px 20px",
        background: "#fff"
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "2.5em",
            fontWeight: "700",
            color: "#1e3c72",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            What Separates Us from the Pack
          </h2>
          <p style={{
            fontSize: "1.2em",
            color: "#5a6c7d",
            textAlign: "center",
            maxWidth: "800px",
            margin: "0 auto 60px",
            lineHeight: "1.6"
          }}>
            Built with security as our #1 priority. We maintain a strong focus on privacy and data protection—
            <strong> we never sell your data to third parties.</strong>
          </p>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "30px"
          }}>
            {/* Efficiency */}
            <div style={{
              display: "flex",
              gap: "30px",
              padding: "30px",
              background: "#f8f9fc",
              borderRadius: "12px",
              borderLeft: "5px solid #667eea"
            }}>
              <div style={{ minWidth: "50px", fontSize: "2.5em" }}>⚡</div>
              <div>
                <h3 style={{
                  fontSize: "1.6em",
                  fontWeight: "700",
                  color: "#1e3c72",
                  marginBottom: "12px"
                }}>
                  Efficiency
                </h3>
                <p style={{
                  fontSize: "1.1em",
                  color: "#5a6c7d",
                  lineHeight: "1.7",
                  marginBottom: "10px"
                }}>
                  Streamlines repetitive tasks like tagging, searching, and exporting, cutting paralegal and admin hours.
                </p>
                <p style={{
                  fontSize: "1.05em",
                  color: "#2166e8",
                  fontWeight: "600",
                  lineHeight: "1.6"
                }}>
                  → Saves time, reduces costs, and accelerates case preparation.
                </p>
              </div>
            </div>

            {/* Compliance */}
            <div style={{
              display: "flex",
              gap: "30px",
              padding: "30px",
              background: "#f8f9fc",
              borderRadius: "12px",
              borderLeft: "5px solid #f5576c"
            }}>
              <div style={{ minWidth: "50px", fontSize: "2.5em" }}>✓</div>
              <div>
                <h3 style={{
                  fontSize: "1.6em",
                  fontWeight: "700",
                  color: "#1e3c72",
                  marginBottom: "12px"
                }}>
                  Compliance
                </h3>
                <p style={{
                  fontSize: "1.1em",
                  color: "#5a6c7d",
                  lineHeight: "1.7",
                  marginBottom: "10px"
                }}>
                  Generates audit-ready exports that stand up in court and reduce risk in discovery disputes.
                </p>
                <p style={{
                  fontSize: "1.05em",
                  color: "#2166e8",
                  fontWeight: "600",
                  lineHeight: "1.6"
                }}>
                  → Ensures defensible processes and protects against costly sanctions.
                </p>
              </div>
            </div>

            {/* Accessibility */}
            <div style={{
              display: "flex",
              gap: "30px",
              padding: "30px",
              background: "#f8f9fc",
              borderRadius: "12px",
              borderLeft: "5px solid #4facfe"
            }}>
              <div style={{ minWidth: "50px", fontSize: "2.5em" }}>👥</div>
              <div>
                <h3 style={{
                  fontSize: "1.6em",
                  fontWeight: "700",
                  color: "#1e3c72",
                  marginBottom: "12px"
                }}>
                  Accessibility
                </h3>
                <p style={{
                  fontSize: "1.1em",
                  color: "#5a6c7d",
                  lineHeight: "1.7",
                  marginBottom: "10px"
                }}>
                  Intuitive enough for legal assistants, yet powerful enough for attorneys.
                </p>
                <p style={{
                  fontSize: "1.05em",
                  color: "#2166e8",
                  fontWeight: "600",
                  lineHeight: "1.6"
                }}>
                  → Teams adopt quickly, with no steep learning curve or expensive training.
                </p>
              </div>
            </div>

            {/* Security & Privacy */}
            <div style={{
              display: "flex",
              gap: "30px",
              padding: "30px",
              background: "#f8f9fc",
              borderRadius: "12px",
              borderLeft: "5px solid #764ba2"
            }}>
              <div style={{ minWidth: "50px", fontSize: "2.5em" }}>🔒</div>
              <div>
                <h3 style={{
                  fontSize: "1.6em",
                  fontWeight: "700",
                  color: "#1e3c72",
                  marginBottom: "12px"
                }}>
                  Security & Privacy
                </h3>
                <p style={{
                  fontSize: "1.1em",
                  color: "#5a6c7d",
                  lineHeight: "1.7",
                  marginBottom: "10px"
                }}>
                  Built with secure upload, storage, and export protocols to safeguard sensitive case data.
                </p>
                <p style={{
                  fontSize: "1.05em",
                  color: "#2166e8",
                  fontWeight: "600",
                  lineHeight: "1.6"
                }}>
                  → Protects client confidentiality and meets strict legal privacy standards.
                </p>
              </div>
            </div>

            {/* Affordable Pricing */}
            <div style={{
              display: "flex",
              gap: "30px",
              padding: "30px",
              background: "#f8f9fc",
              borderRadius: "12px",
              borderLeft: "5px solid #43e97b"
            }}>
              <div style={{ minWidth: "50px", fontSize: "2.5em" }}>💰</div>
              <div>
                <h3 style={{
                  fontSize: "1.6em",
                  fontWeight: "700",
                  color: "#1e3c72",
                  marginBottom: "12px"
                }}>
                  Affordable Pricing
                </h3>
                <p style={{
                  fontSize: "1.1em",
                  color: "#5a6c7d",
                  lineHeight: "1.7",
                  marginBottom: "10px"
                }}>
                  No upfront implementation fees and significantly lower monthly costs compared to industry competitors.
                </p>
                <p style={{
                  fontSize: "1.05em",
                  color: "#2166e8",
                  fontWeight: "600",
                  lineHeight: "1.6"
                }}>
                  → Get enterprise-grade eDiscovery without breaking the bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section style={{
        padding: "80px 20px",
        background: "#f8f9fc",
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "2.5em",
            fontWeight: "700",
            color: "#1e3c72",
            marginBottom: "60px"
          }}>
            Why Legal Teams Choose Us
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "40px",
            textAlign: "left"
          }}>
            {/* Benefit 1 */}
            <div style={{
              background: "#fff",
              padding: "40px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}>
              <div style={{
                width: "70px",
                height: "70px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                fontSize: "2em"
              }}>
                📁
              </div>
              <h3 style={{
                fontSize: "1.5em",
                fontWeight: "700",
                color: "#1e3c72",
                marginBottom: "16px"
              }}>
                Centralized Case Management
              </h3>
              <p style={{
                fontSize: "1.1em",
                color: "#5a6c7d",
                lineHeight: "1.7"
              }}>
                Keep all your cases, documents, and evidence organized in one secure location. 
                Quick access to everything you need, exactly when you need it.
              </p>
            </div>

            {/* Benefit 2 */}
            <div style={{
              background: "#fff",
              padding: "40px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}>
              <div style={{
                width: "70px",
                height: "70px",
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                fontSize: "2em"
              }}>
                🔍
              </div>
              <h3 style={{
                fontSize: "1.5em",
                fontWeight: "700",
                color: "#1e3c72",
                marginBottom: "16px"
              }}>
                Advanced Search & Discovery
              </h3>
              <p style={{
                fontSize: "1.1em",
                color: "#5a6c7d",
                lineHeight: "1.7"
              }}>
                Powerful search capabilities to find critical information instantly. 
                Filter by case, document type, date, or custom metadata.
              </p>
            </div>

            {/* Benefit 3 */}
            <div style={{
              background: "#fff",
              padding: "40px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}>
              <div style={{
                width: "70px",
                height: "70px",
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                fontSize: "2em"
              }}>
                🔒
              </div>
              <h3 style={{
                fontSize: "1.5em",
                fontWeight: "700",
                color: "#1e3c72",
                marginBottom: "16px"
              }}>
                Enterprise-Grade Security
              </h3>
              <p style={{
                fontSize: "1.1em",
                color: "#5a6c7d",
                lineHeight: "1.7"
              }}>
                Bank-level encryption and role-based access control. 
                Complete audit trails ensure compliance and accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section style={{
        background: "linear-gradient(135deg, #2a5298 0%, #1e3c72 100%)",
        color: "#fff",
        padding: "80px 20px",
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "2.8em",
            fontWeight: "700",
            marginBottom: "20px"
          }}>
            Ready to Transform Your Legal Workflow?
          </h2>
          <p style={{
            fontSize: "1.3em",
            marginBottom: "40px",
            opacity: 0.95,
            fontWeight: "300"
          }}>
            Join thousands of legal professionals who trust our platform for their case management needs.
          </p>
          <button
            onClick={onGetStarted}
            style={{
              background: "#fff",
              color: "#1e3c72",
              border: "none",
              padding: "18px 48px",
              fontSize: "1.2em",
              fontWeight: "700",
              borderRadius: "50px",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
            }}
          >
            Start Your Free Trial →
          </button>
          <p style={{
            marginTop: "20px",
            fontSize: "0.95em",
            opacity: 0.8
          }}>
            No credit card required • Setup in minutes • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: "#1a1a2e",
        color: "#ccc",
        padding: "40px 20px",
        textAlign: "center"
      }}>
        <p style={{ margin: "0", fontSize: "0.95em" }}>
          © 2025 eDiscovery Demo. All rights reserved.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: "0.9em", opacity: 0.7 }}>
          Secure • Compliant • Trusted by Legal Professionals
        </p>
      </footer>
    </div>
  );
}
