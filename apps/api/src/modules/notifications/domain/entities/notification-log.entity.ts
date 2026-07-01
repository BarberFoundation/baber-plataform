import { randomUUID } from 'crypto';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationStatus } from '../value-objects/notification-status';

export interface NotificationLogProps {
  id: string;
  tenantId: string;
  appointmentId: string;
  type: NotificationType;
  phone: string;
  message: string;
  status: NotificationStatus;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface CreateNotificationLogProps {
  tenantId: string;
  appointmentId: string;
  type: NotificationType;
  phone: string;
  message: string;
}

export class NotificationLog {
  readonly id: string;
  readonly tenantId: string;
  readonly appointmentId: string;
  readonly type: NotificationType;
  readonly phone: string;
  readonly message: string;
  private _status: NotificationStatus;
  private _sentAt: Date | null;
  private _error: string | null;
  readonly createdAt: Date;

  private constructor(props: NotificationLogProps) {
    this.id            = props.id;
    this.tenantId      = props.tenantId;
    this.appointmentId = props.appointmentId;
    this.type          = props.type;
    this.phone         = props.phone;
    this.message       = props.message;
    this._status       = props.status;
    this._sentAt       = props.sentAt;
    this._error        = props.error;
    this.createdAt     = props.createdAt;
  }

  get status(): NotificationStatus { return this._status; }
  get sentAt(): Date | null        { return this._sentAt; }
  get error(): string | null       { return this._error; }

  static create(props: CreateNotificationLogProps): NotificationLog {
    return new NotificationLog({
      id:            randomUUID(),
      tenantId:      props.tenantId,
      appointmentId: props.appointmentId,
      type:          props.type,
      phone:         props.phone,
      message:       props.message,
      status:        'PENDING',
      sentAt:        null,
      error:         null,
      createdAt:     new Date(),
    });
  }

  static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }

  markSent(): void {
    this._status = 'SENT';
    this._sentAt = new Date();
  }

  markFailed(error: string): void {
    this._status = 'FAILED';
    this._error  = error;
  }
}
