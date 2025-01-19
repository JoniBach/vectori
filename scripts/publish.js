const { execSync } = require("child_process");

// Prevent infinite loop by checking if running inside npm publish
if (process.env.npm_lifecycle_event !== "publish") {
  try {
    // Increment patch version
    execSync("npm version patch", { stdio: "inherit" });

    // Publish the package
    execSync("npm publish", { stdio: "inherit" });

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
