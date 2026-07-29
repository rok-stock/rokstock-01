import packageJson from "../../package.json";

export default function VersionBadge() {
  return (
    <span className="text-xs text-zinc-400 dark:text-zinc-600">
      v{packageJson.version}
    </span>
  );
}
