package ports

import (
	"context"
	"os"
	"time"
)

type Result struct {
	Target Identity `json:"target"`
	Status string   `json:"status"`
	Detail string   `json:"detail"`
}
type Operator struct {
	Inspect func(context.Context, int32) Identity
	Signal  func(context.Context, Identity, bool) error
	Self    int32
	Wait    time.Duration
}

func NewOperator() Operator {
	return Operator{Inspect, signal, int32(os.Getpid()), 1500 * time.Millisecond}
}
func (o Operator) Execute(ctx context.Context, targets []Identity, force bool) []Result {
	results := []Result{}
	seen := map[int32]bool{}
	for _, target := range targets {
		if seen[target.PID] {
			continue
		}
		seen[target.PID] = true
		r := Result{Target: target}
		if err := ValidateTargets([]Identity{target}, o.Self); err != nil {
			r.Status = "unsafe_target"
			r.Detail = err.Error()
			results = append(results, r)
			continue
		}
		actual := o.Inspect(ctx, target.PID)
		switch {
		case ctx.Err() != nil:
			r.Status = Classify(ctx.Err())
		case actual.Status == "exited":
			r.Status = "exited"
		case actual.Created == 0:
			r.Status = actual.Status
		case actual.Created != target.Created:
			r.Status = "identity_changed"
		default:
			if err := o.Signal(ctx, target, force); err != nil {
				r.Status = Classify(err)
				if f, ok := err.(*Fault); ok {
					r.Status = f.Code
				}
				r.Detail = err.Error()
			} else {
				r.Status = "still_running"
				deadline := time.NewTimer(o.Wait)
				ticker := time.NewTicker(50 * time.Millisecond)
			wait:
				for {
					select {
					case <-ctx.Done():
						r.Status = Classify(ctx.Err())
						break wait
					case <-deadline.C:
						break wait
					case <-ticker.C:
						p := o.Inspect(ctx, target.PID)
						if p.Status == "exited" || p.Created != 0 && p.Created != target.Created {
							r.Status = "exited"
							break wait
						}
					}
				}
				deadline.Stop()
				ticker.Stop()
			}
		}
		results = append(results, r)
	}
	return results
}
