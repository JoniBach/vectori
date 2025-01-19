const { execSync } = require("child_process");

if (!process.env.PUBLISHING) {
  try {
    // Increment patch version
    execSync("npm version patch", { stdio: "inherit" });

    // Set an environment variable to prevent recursion
    execSync("PUBLISHING=true npm publish", { stdio: "inherit" });

    console.log(
      "Patch version incremented and package published successfully."
    );
  } catch (error) {
    console.error("Error during publishing:", error.message);
    process.exit(1);
  }
} else {
  console.log("Script skipped to prevent infinite loop.");
}
