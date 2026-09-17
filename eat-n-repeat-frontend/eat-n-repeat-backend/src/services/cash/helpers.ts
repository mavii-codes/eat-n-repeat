export function mapShift(row: {
  id: string;
  staffId: string;
  staffName: string;
  startTime: Date;
  endTime: Date | null;
  startingFloat: any;
  expectedCash: any;
  actualCash: any;
  difference: any;
  status: string;
}) {
  return {
    id: row.id,
    staff_id: row.staffId,
    staff_name: row.staffName,
    start_time: row.startTime,
    end_time: row.endTime,
    starting_float: Number(row.startingFloat),
    expected_cash: Number(row.expectedCash),
    actual_cash: row.actualCash != null ? Number(row.actualCash) : null,
    difference: row.difference != null ? Number(row.difference) : null,
    status: row.status,
  };
}

export function mapTransaction(row: {
  id: string;
  shiftId: string;
  orderId: string | null;
  type: string;
  amount: any;
  adminId: string | null;
  adminName: string | null;
  reason: string | null;
  timestamp: Date;
}) {
  return {
    id: row.id,
    shift_id: row.shiftId,
    order_id: row.orderId,
    type: row.type,
    amount: Number(row.amount),
    admin_id: row.adminId,
    admin_name: row.adminName,
    reason: row.reason,
    timestamp: row.timestamp,
  };
}
