
export function sanitizeDatabaseName(
    dbName: string,
    maxLength: number = 63
): string {
    let sanitizedName = dbName.toLowerCase().replace(/-/g, "_");
    if (sanitizedName.length > maxLength) {
        sanitizedName = sanitizedName.substring(0, maxLength);
    }
    return sanitizedName;
}
