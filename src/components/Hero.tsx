export default function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(72px,8vw,140px)",
            lineHeight: "0.9",
            letterSpacing: "-0.08em",
            fontWeight: 900,
            maxWidth: "1000px",
          }}
        >
          The future of skincare
          <br />
          is not more products.
          <br />
          It's better decisions.
        </h1>

        <p
          style={{
            marginTop: "32px",
            fontSize: "22px",
            opacity: 0.75,
            maxWidth: "700px",
          }}
        >
          Skin ID transforms product catalogs into personalized buying
          journeys.
        </p>

        <div
          style={{
            marginTop: "48px",
            display: "flex",
            gap: "16px",
          }}
        >
          <button>Request a Demo</button>
          <button>Discover Skin ID</button>
        </div>
      </div>
    </section>
  );
}