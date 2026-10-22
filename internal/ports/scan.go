package ports

import "context"

func Scan(ctx context.Context, elevated bool) (Snapshot, error) {
	entries, err := connections(ctx)
	if err != nil {
		return Snapshot{}, err
	}
	cache := map[int32]Identity{}
	for n := range entries {
		if err = ctx.Err(); err != nil {
			return Snapshot{}, err
		}
		pid := entries[n].Process.PID
		i, ok := cache[pid]
		if !ok {
			i = Inspect(ctx, pid)
			cache[pid] = i
		}
		entries[n].Process = i
		entries[n].Identify(entries[n].ID)
	}
	visibility := "ordinary"
	if elevated {
		visibility = "authorized"
	}
	return Snapshot{entries, visibility}, nil
}
