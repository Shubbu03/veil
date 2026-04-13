import toast from "react-hot-toast";

export type NotificationType = "success" | "error" | "warn" | "info";

export const notify = (message: string, type: NotificationType = "info") => {
    const baseStyle = {
        fontWeight: "500",
        borderRadius: "16px",
        fontSize: "14px",
        lineHeight: "1.4",
        padding: "12px 16px",
        background: "var(--color-card)",
        color: "var(--color-card-foreground)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-panel)",
        backdropFilter: "blur(14px)",
    };

    switch (type) {
        case "success":
            return toast.success(message, {
                duration: 4000,
                position: "bottom-right",
                iconTheme: {
                    primary: "#56c489",
                    secondary: "#0f1720",
                },
                style: {
                    ...baseStyle,
                    border: "1px solid color-mix(in oklab, var(--color-success) 45%, var(--color-border))",
                },
            });

        case "error":
            return toast.error(message, {
                duration: 5000,
                position: "bottom-right",
                iconTheme: {
                    primary: "#ef6a5f",
                    secondary: "#0f1720",
                },
                style: {
                    ...baseStyle,
                    border: "1px solid color-mix(in oklab, var(--color-destructive) 50%, var(--color-border))",
                },
            });

        case "warn":
            return toast(message, {
                duration: 4000,
                position: "bottom-right",
                icon: "!",
                style: {
                    ...baseStyle,
                    border: "1px solid color-mix(in oklab, var(--color-warning) 50%, var(--color-border))",
                },
            });

        case "info":
        default:
            return toast(message, {
                duration: 3000,
                position: "bottom-right",
                icon: "i",
                style: {
                    ...baseStyle,
                },
            });
    }
};

export function userFacingError(error: unknown, fallback: string) {
    if (!(error instanceof Error)) {
        return fallback;
    }

    const message = error.message.trim();
    if (!message) {
        return fallback;
    }

    if (
        /simulation failed|sendtransactionerror|anchorerror|custom program error|already been processed/i.test(message)
    ) {
        return fallback;
    }

    return message;
}
