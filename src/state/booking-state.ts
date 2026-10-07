export type BookingPhase =
  | "IDLE"
  | "BROWSER_READY"
  | "AUTHENTICATED"
  | "DATE_SELECTED"
  | "SLOT_SELECTED"
  | "TICKETS_SELECTED"
  | "PILGRIMS_FILLED"
  | "CONFIRMATION_READY"
  | "PAYMENT_READY"
  | "USER_PAYMENT_REQUIRED"
  | "PAYMENT_COMPLETED"
  | "BOOKING_CONFIRMED"
  | "USER_ACTION_REQUIRED"
  | "ERROR";

export interface BookingState {
  phase: BookingPhase;
  date?: string;
  slot?: string;
  ticketCount?: number;
  message?: string;
  updatedAt: string;
}

export class BookingStateStore {
  private state: BookingState = { phase: "IDLE", updatedAt: new Date().toISOString() };

  get(): BookingState {
    return { ...this.state };
  }

  set(phase: BookingPhase, patch: Partial<Omit<BookingState, "phase">> = {}): BookingState {
    this.state = { ...this.state, ...patch, phase, updatedAt: new Date().toISOString() };
    return this.get();
  }
}
