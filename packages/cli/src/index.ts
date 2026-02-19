#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("ranger")
  .description("Self-hosted UI feature review automation")
  .version("0.0.1");

program
  .command("setup")
  .description("Initialize Ranger server, database, and config")
  .action(() => {
    console.log("TODO: ranger setup");
  });

program
  .command("profile")
  .description("Manage browser profiles")
  .addCommand(
    new Command("add")
      .description("Add a new profile")
      .argument("<name>", "Profile name")
      .option("--base-url <url>", "Base URL for the profile")
      .action((name: string) => {
        console.log(`TODO: ranger profile add ${name}`);
      })
  )
  .addCommand(
    new Command("list")
      .description("List all profiles")
      .action(() => {
        console.log("TODO: ranger profile list");
      })
  )
  .addCommand(
    new Command("show")
      .description("Show profile details")
      .argument("<name>", "Profile name")
      .action((name: string) => {
        console.log(`TODO: ranger profile show ${name}`);
      })
  )
  .addCommand(
    new Command("set-default")
      .description("Set the default profile")
      .argument("<name>", "Profile name")
      .action((name: string) => {
        console.log(`TODO: ranger profile set-default ${name}`);
      })
  )
  .addCommand(
    new Command("remove")
      .description("Remove a profile")
      .argument("<name>", "Profile name")
      .action((name: string) => {
        console.log(`TODO: ranger profile remove ${name}`);
      })
  );

program
  .command("create")
  .description("Create a new feature review")
  .option("--title <title>", "Review title")
  .option("--branch <branch>", "Git branch")
  .option("--profile <name>", "Profile to use")
  .action(() => {
    console.log("TODO: ranger create");
  });

program
  .command("list")
  .description("List feature reviews")
  .option("--status <status>", "Filter by status")
  .option("--branch <branch>", "Filter by branch")
  .action(() => {
    console.log("TODO: ranger list");
  });

program
  .command("show")
  .description("Show feature review details")
  .argument("<id>", "Review ID")
  .action((id: string) => {
    console.log(`TODO: ranger show ${id}`);
  });

program
  .command("go")
  .description("Run verification on a feature review")
  .argument("[id]", "Review ID")
  .option("--profile <name>", "Profile to use")
  .option("--scenario <ids...>", "Specific scenario IDs")
  .option("--notes <text>", "Notes for the verification run")
  .option("--watch", "Watch live progress via SSE")
  .option("--ci", "CI mode: JSON output, exit code based on verdict")
  .action((id: string | undefined) => {
    console.log(`TODO: ranger go ${id ?? "(current review)"}`);
  });

program
  .command("hook")
  .description("Handle Claude Code hook events")
  .argument("<hookType>", "Hook type (session-start, post-edit, etc.)")
  .option("--files <files...>", "Changed files (for post-edit hook)")
  .action((hookType: string) => {
    console.log(`TODO: ranger hook ${hookType}`);
  });

program
  .command("clean")
  .description("Remove old artifacts and purge deleted reviews")
  .option("--days <n>", "Delete artifacts older than N days", "30")
  .action(() => {
    console.log("TODO: ranger clean");
  });

program
  .command("login")
  .description("Authenticate a profile via browser")
  .option("--profile <name>", "Profile to authenticate")
  .action(() => {
    console.log("TODO: ranger login");
  });

program.parse();
