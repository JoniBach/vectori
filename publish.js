const { execSync } = require("child_process");

try {
  // Increment patch version
  execSync("npm version patch", { stdio: "inherit" });

  // Publish the package
  execSync("npm publish", { stdio: "inherit" });

  console.log("Patch version incremented and package published successfully.");
} catch (error) {
  console.error("Error during publishing:", error.message);
  process.exit(1);
}
