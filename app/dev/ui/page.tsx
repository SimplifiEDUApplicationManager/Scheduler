'use client';

// UI primitives demo page — visit /dev/ui while running `npm run dev`.
// Renders every variant of every component. Dev-only; remove before prod.

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Dialog,
  DialogActions,
  Avatar,
  CapacityBar,
} from '@/components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-h3 font-semibold text-fg-1 mb-4 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

export default function UiDemoPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="min-h-screen bg-surface-2 p-10">
      <h1 className="text-h1 font-bold text-fg-1 mb-2">UI Primitives</h1>
      <p className="text-body text-fg-3 mb-10">Every variant of every base component.</p>

      {/* Button */}
      <Section title="Button">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>
        <Row className="mt-3">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
        </Row>
      </Section>

      {/* Badge */}
      <Section title="Badge">
        <Row>
          <Badge variant="default">Default</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
        </Row>
        <Row className="mt-3">
          <Badge variant="HIGH">HIGH</Badge>
          <Badge variant="MEDIUM">MEDIUM</Badge>
          <Badge variant="UNPROVEN">UNPROVEN</Badge>
          <Badge variant="LOW">LOW</Badge>
        </Row>
        <Row className="mt-3">
          <Badge variant="success" size="xs">
            xs
          </Badge>
          <Badge variant="success" size="sm">
            sm
          </Badge>
          <Badge variant="success" size="md">
            md
          </Badge>
        </Row>
      </Section>

      {/* Card */}
      <Section title="Card">
        <div className="grid grid-cols-2 gap-4">
          {(['default', 'elevated', 'brand', 'flat'] as const).map((v) => (
            <Card key={v} variant={v}>
              <CardHeader>
                <CardTitle>{v} card</CardTitle>
              </CardHeader>
              <p className="text-body text-fg-3">
                Card body text with a bit of content to show layout.
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Input */}
      <Section title="Input">
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <Input label="Label" placeholder="Placeholder" />
          <Input label="With value" value={inputVal} onChange={(e) => setInputVal(e.target.value)} />
          <Input label="With hint" placeholder="you@example.com" hint="Used for magic-link login." />
          <Input label="Error state" defaultValue="bad input" error="This field is required." />
          <Input label="Disabled" placeholder="Can't touch this" disabled />
        </div>
      </Section>

      {/* Select */}
      <Section title="Select">
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <Select
            label="Subject"
            placeholder="Choose a subject"
            options={[
              { value: 'ap-calc', label: 'AP Calculus BC' },
              { value: 'ap-phys', label: 'AP Physics C' },
              { value: 'sat-math', label: 'SAT Math' },
            ]}
          />
          <Select
            label="Error state"
            options={[{ value: 'a', label: 'Option A' }]}
            error="Please select a value."
          />
          <Select
            label="Disabled"
            options={[{ value: 'a', label: 'Option A' }]}
            disabled
          />
        </div>
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        <Row>
          {(['neutral', 'brand', 'cream', 'dark'] as const).map((tone) => (
            <div key={tone} className="flex flex-col items-center gap-1">
              <Avatar initials="AB" tone={tone} size="lg" />
              <span className="text-xxs text-fg-3">{tone}</span>
            </div>
          ))}
        </Row>
        <Row className="mt-4">
          {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-1">
              <Avatar initials="JD" tone="brand" size={size} />
              <span className="text-xxs text-fg-3">{size}</span>
            </div>
          ))}
        </Row>
      </Section>

      {/* CapacityBar */}
      <Section title="CapacityBar">
        <div className="space-y-4 max-w-xs">
          <div>
            <p className="text-xs text-fg-3 mb-1">OK (8 / 20h)</p>
            <CapacityBar current={8} max={20} />
          </div>
          <div>
            <p className="text-xs text-fg-3 mb-1">Near capacity (17 / 20h)</p>
            <CapacityBar current={17} max={20} />
          </div>
          <div>
            <p className="text-xs text-fg-3 mb-1">At capacity (20 / 20h)</p>
            <CapacityBar current={20} max={20} />
          </div>
        </div>
      </Section>

      {/* Dialog */}
      <Section title="Dialog">
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          Open Dialog
        </Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Confirm Action"
          description="Are you sure you want to proceed? This cannot be undone."
        >
          <p className="text-body text-fg-2 mb-2">
            Additional dialog content goes here — form fields, warnings, etc.
          </p>
          <DialogActions>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDialogOpen(false)}>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Section>
    </div>
  );
}
