export function buildOtpAuthUrl({
    issuer,
    account,
    secretBase32,
}: {
    issuer: string;
    account: string;
    secretBase32: string;
}) {
    const encIssuer = encodeURIComponent(issuer);
    const encAccount = encodeURIComponent(account);

    return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
