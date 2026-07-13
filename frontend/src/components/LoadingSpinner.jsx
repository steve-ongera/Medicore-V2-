// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ fullscreen = false, size = "md", label = "Loading..." }) {
  const spinner = (
    <div className="loading-screen">
      <div className="spinner" style={size === "lg" ? { width: "32px", height: "32px", borderWidth: "3px" } : undefined}></div>
      <div className="loading-screen__label">{label}</div>
    </div>
  );

  if (!fullscreen) return spinner;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100%'
      }}
    >
      {spinner}
    </div>
  );
}