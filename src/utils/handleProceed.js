export const handleProceed = async (file, setStep, setError) => {
  if (!file) {
    setError("No file selected.");
    return;
  }

  try {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const formData = new FormData();
    formData.append("file", file);

    // Upload raw file to backend
    await fetch(`${API_URL}/api/businesses/import`, {
      method: "POST",
      body: formData,
    });

    // Trigger ML script
    await fetch(`${API_URL}/api/predictions/generate`, { method: "POST" });

    setStep(3);
    console.log("File uploaded and predictions generated.");
  } catch (err) {
    console.error("Error in handleProceed:", err);
    setError("Error uploading dataset: " + err.message);
  }
};
