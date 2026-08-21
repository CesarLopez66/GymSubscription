"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError } from "@/lib/api-client"
import { useCheckIns, useVerifyCheckIn } from "@/hooks/use-checkins"
import { useUsers } from "@/hooks/use-users"

export default function CheckInMonitorPage() {
  const [selectedMember, setSelectedMember] = React.useState<string>("")
  const { data: members } = useUsers("MEMBER", 1, 200)
  const { data: checkIns } = useCheckIns(undefined, { live: true })
  const verify = useVerifyCheckIn()

  const memberName = (userId: string) => {
    const m = members?.items.find((u) => u.id === userId)
    return m ? `${m.first_name} ${m.last_name}` : userId.slice(0, 8)
  }

  const handleScan = () => {
    if (!selectedMember) return
    verify.mutate(selectedMember, {
      onSuccess: (result) => {
        if (result.access_granted) {
          toast.success(`Access granted — ${memberName(selectedMember)}`)
        } else {
          toast.error(`Access denied — ${result.denial_reason ?? "unknown reason"}`)
        }
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "Check-in failed")
      },
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Check-in monitor</h1>

      <Card>
        <CardHeader>
          <CardTitle>Front desk scan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={selectedMember}
            onValueChange={(value) => setSelectedMember(value ?? "")}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {(members?.items ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleScan} disabled={!selectedMember || verify.isPending}>
            {verify.isPending ? "Verifying…" : "Verify access"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live feed</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(checkIns?.items ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="font-medium">{memberName(c.user_id)}</TableCell>
                  <TableCell>
                    {c.access_granted ? (
                      <Badge className="gap-1">
                        <CheckCircle2 className="size-3" />
                        Granted
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="size-3" />
                        {c.denial_reason ?? "Denied"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(checkIns?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No check-ins yet today.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
