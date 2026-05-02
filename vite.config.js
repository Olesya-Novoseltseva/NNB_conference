import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
function normalizeBase(raw) {
    if (!raw || raw === "/")
        return "/";
    const trimmed = raw.trim();
    if (!trimmed)
        return "/";
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}
export default defineConfig({
    plugins: [react()],
    base: normalizeBase(process.env.BASE_PATH),
});
