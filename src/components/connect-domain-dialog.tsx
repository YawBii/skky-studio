import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  ShieldCheck,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Step = "enter" | "dns" | "verifying" | "ssl" | "active" | "failed";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected?: (domain: string) => void;
}

const TARGET_IP = "185.158.133.1";

export function ConnectDomainDialog({ open, onOpenChange, onConnected }: Props) {
  const [step, setStep] = useState<Step>("enter");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  // DNS check items
  const [aRoot, setARoot] = useState<"pending" | "ok" | "fail">("pending");
  const [aWww, setAWww] = useState<"pending" | "ok" | "fail">("pending");
  const [txt, setTxt] = useState<"pending" | "ok" | "fail">("pending");
  const [ssl, setSsl] = useState<"pending" | "issuing" | "ok" | "fail">("pending");

  const verifyToken = useMemo(
    () => `lovable_verify=${Math.random().toString(36).slice(2, 12)}`,
    [open],
  );

  useEffect(() => {
    if (!open) {
      // reset on close
      setStep("enter");
      setDomain("");
      setError(null);
      setARoot("pending");
      setAWww("pending");
      setTxt("pending");
      setSsl("pending");
    }
  }, [open]);

  // Simulated DNS poll — in production this hits an edge function that resolves DNS server-side.
  useEffect(() => {
    if (step !== "verifying") return;
    let cancelled = false;
    const tick = async (n: number) => {
      if (cancelled) return;
      // Stage results to mimic real propagation
      if (n >= 1) setARoot("ok");
      if (n >= 2) setTxt("ok");
      if (n >= 3) setAWww("ok");
      if (n >= 3) {
        setStep("ssl");
        setSsl("issuing");
        setTimeout(() => {
          if (cancelled) return;
          setSsl("ok");
          setStep("active");
        }, 1800);
        return;
      }
      setTimeout(() => tick(n + 1), 1400);
    };
    tick(1);
    return () => {
      cancelled = true;
    };
  }, [step]);

  const validDomain = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(domain.trim());

  const startVerification = () => {
    if (!validDomain) {
      setError("Enter a valid domain (e.g. portal.skky.group).");
      return;
    }
    setError(null);
    setStep("dns");
  };

  const copy = (v: string, label: string) => {
    try {
      navigator.clipboard.writeText(v);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Connect a custom domain
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-warning">
              Preview workflow
            </span>
          </DialogTitle>
          <DialogDescription>
            We'll verify DNS, provision SSL, and keep polling until your domain is live.
          </DialogDescription>
          <div className="mt-1 rounded-md border border-warning/20 bg-warning/5 px-2.5 py-1.5 text-[11px] text-warning/90 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Simulation — backend DNS &amp; SSL verification not connected yet. Records and
              statuses below are illustrative.
            </span>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Pill active={step === "enter"} done={step !== "enter"}>
            1 · Domain
          </Pill>
          <span>›</span>
          <Pill
            active={step === "dns" || step === "verifying"}
            done={["ssl", "active"].includes(step)}
          >
            2 · DNS
          </Pill>
          <span>›</span>
          <Pill active={step === "ssl"} done={step === "active"}>
            3 · SSL
          </Pill>
          <span>›</span>
          <Pill active={step === "active"} done={step === "active"}>
            4 · Live
          </Pill>
        </div>

        {step === "enter" && (
          <div className="mt-2 space-y-3">
            <label className="text-[12px] text-muted-foreground">Domain</label>
            <input
              autoFocus
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startVerification()}
              placeholder="portal.skky.group"
              className="w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-[13px] font-mono outline-none focus:border-primary/50"
            />
            {error && (
              <div className="text-[11.5px] text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> {error}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="hero" size="sm" onClick={startVerification}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {(step === "dns" || step === "verifying") && (
          <div className="mt-2 space-y-4">
            <div className="text-[12.5px] text-muted-foreground">
              Add these records at your DNS provider for{" "}
              <span className="font-mono text-foreground">{domain}</span>.
            </div>
            <RecordRow type="A" name="@" value={TARGET_IP} onCopy={copy} />
            <RecordRow type="A" name="www" value={TARGET_IP} onCopy={copy} />
            <RecordRow type="TXT" name="_lovable" value={verifyToken} onCopy={copy} />

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[11.5px] text-muted-foreground">
              DNS propagation can take a few minutes (rarely up to 72h). We'll poll automatically.
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep("enter")}>
                Back
              </Button>
              <Button variant="hero" size="sm" onClick={() => setStep("verifying")}>
                {step === "verifying" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
                  </>
                ) : (
                  "I've added the records"
                )}
              </Button>
            </div>

            {step === "verifying" && (
              <div className="rounded-xl border border-white/5 bg-gradient-card p-3 space-y-2">
                <CheckItem label="A record · @ → 185.158.133.1" status={aRoot} />
                <CheckItem label="A record · www → 185.158.133.1" status={aWww} />
                <CheckItem label="TXT _lovable verification" status={txt} />
              </div>
            )}
          </div>
        )}

        {step === "ssl" && (
          <div className="mt-2 space-y-3">
            <div className="rounded-xl border border-white/5 bg-gradient-card p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" /> Provisioning SSL certificate
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1">
                Issuing a Let's Encrypt certificate for <span className="font-mono">{domain}</span>.
              </div>
              <div className="mt-3 space-y-2">
                <CheckItem label="DNS verified" status="ok" />
                <CheckItem label="Certificate issued" status={ssl === "ok" ? "ok" : "pending"} />
                <CheckItem label="HTTPS handshake" status={ssl === "ok" ? "ok" : "pending"} />
              </div>
            </div>
          </div>
        )}

        {step === "active" && (
          <div className="mt-2 space-y-3">
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-warning">
                <AlertTriangle className="h-4 w-4" /> Simulated success for {domain}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1">
                This is a preview of what the live state will look like. We have{" "}
                <span className="text-foreground">not</span> actually verified DNS or issued an SSL
                certificate yet — that needs a real backend verification function.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => {
                  toast("Coming next: real DNS + SSL verification.");
                  onConnected?.(domain);
                  onOpenChange(false);
                }}
              >
                Use as primary
              </Button>
            </div>
          </div>
        )}

        {step === "failed" && (
          <div className="mt-2 space-y-3">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-[12.5px]">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <X className="h-4 w-4" /> Verification failed
              </div>
              <div className="mt-1 text-muted-foreground">
                Check your DNS records and try again.
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="hero" size="sm" onClick={() => setStep("dns")}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Pill({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full border",
        done
          ? "border-success/30 bg-success/10 text-success"
          : active
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-white/10 bg-white/[0.03] text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function RecordRow({
  type,
  name,
  value,
  onCopy,
}: {
  type: string;
  name: string;
  value: string;
  onCopy: (v: string, label: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-gradient-card p-3 grid grid-cols-12 gap-2 items-center text-[12px]">
      <div className="col-span-2 text-muted-foreground">
        Type
        <br />
        <span className="font-mono text-foreground text-[12.5px]">{type}</span>
      </div>
      <div className="col-span-3 text-muted-foreground">
        Name
        <br />
        <span className="font-mono text-foreground text-[12.5px]">{name}</span>
      </div>
      <div className="col-span-6 text-muted-foreground min-w-0">
        Value
        <br />
        <span className="font-mono text-foreground text-[12.5px] truncate block">{value}</span>
      </div>
      <button
        onClick={() => onCopy(value, type)}
        className="col-span-1 inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/10"
        title="Copy value"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CheckItem({
  label,
  status,
}: {
  label: string;
  status: "pending" | "issuing" | "ok" | "fail";
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {status === "ok" ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : status === "fail" ? (
        <X className="h-3.5 w-3.5 text-destructive" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      <span
        className={cn(
          status === "ok" && "text-foreground",
          status !== "ok" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}
