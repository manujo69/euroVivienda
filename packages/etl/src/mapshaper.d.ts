// mapshaper ships no types; only the API the export uses.
declare module 'mapshaper' {
  const mapshaper: {
    /** Runs mapshaper commands on in-memory files and resolves with the output files. */
    applyCommands(
      commands: string,
      input: Record<string, string>,
    ): Promise<Record<string, string | Uint8Array>>;
  };
  export default mapshaper;
}
