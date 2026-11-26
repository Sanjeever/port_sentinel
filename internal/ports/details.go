package ports

import (
	"context"
	"errors"

	"github.com/shirou/gopsutil/v4/process"
)

type ProcessSummary struct {
	PID     int32  `json:"pid"`
	Created int64  `json:"created"`
	Name    string `json:"name"`
}

type ProcessDetails struct {
	WorkingDir      string           `json:"workingDir"`
	WorkingDirError *Fault           `json:"workingDirError"`
	Parents         []ProcessSummary `json:"parents"`
	ParentsError    *Fault           `json:"parentsError"`
	Error           *Fault           `json:"error"`
}

func DescribeProcess(ctx context.Context, pid int32, created int64) ProcessDetails {
	if pid <= 0 || created <= 0 {
		return ProcessDetails{Error: Failure("identity_unavailable", nil)}
	}
	p, actual, fault := openDetailProcess(ctx, pid)
	if fault != nil {
		return ProcessDetails{Error: fault}
	}
	if actual != created {
		return ProcessDetails{Error: Failure("identity_changed", nil)}
	}
	result := ProcessDetails{Parents: []ProcessSummary{}}
	var err error
	result.WorkingDir, err = p.CwdWithContext(ctx)
	if err != nil {
		result.WorkingDirError = detailFault(err)
	}
	parentPID, err := p.PpidWithContext(ctx)
	if err != nil {
		result.ParentsError = detailFault(err)
	} else {
		result.Parents, result.ParentsError = traceParents(ctx, ProcessSummary{PID: pid, Created: created}, parentPID, readParent)
	}
	if fault := checkDetailIdentity(ctx, pid, created); fault != nil {
		return ProcessDetails{Error: fault}
	}
	return result
}

type parentLink struct {
	process ProcessSummary
	parent  int32
	issue   *Fault
}

func traceParents(ctx context.Context, child ProcessSummary, pid int32, read func(context.Context, int32) (parentLink, *Fault)) ([]ProcessSummary, *Fault) {
	parents := []ProcessSummary{}
	seen := map[int32]bool{child.PID: true}
	for pid > 0 {
		if seen[pid] {
			return parents, Failure("parent_chain_interrupted", nil)
		}
		parent, fault := read(ctx, pid)
		if fault != nil {
			return parents, fault
		}
		// 真实父进程必须先于子进程启动，较新的 PPID 可能已被复用。
		if parent.process.Created > child.Created {
			return parents, Failure("parent_identity_changed", nil)
		}
		parents = append(parents, parent.process)
		if parent.issue != nil {
			return parents, parent.issue
		}
		seen[pid] = true
		child, pid = parent.process, parent.parent
	}
	return parents, nil
}

func readParent(ctx context.Context, pid int32) (parentLink, *Fault) {
	p, created, fault := openDetailProcess(ctx, pid)
	if fault != nil {
		return parentLink{}, fault
	}
	name, _ := p.NameWithContext(ctx) // 名称不可读时仍可展示 PID。
	ppid, err := p.PpidWithContext(ctx)
	if fault := checkDetailIdentity(ctx, pid, created); fault != nil {
		return parentLink{}, fault
	}
	link := parentLink{process: ProcessSummary{PID: pid, Created: created, Name: name}, parent: ppid}
	if err != nil {
		link.issue = detailFault(err)
	}
	return link, nil
}

func openDetailProcess(ctx context.Context, pid int32) (*process.Process, int64, *Fault) {
	if err := ctx.Err(); err != nil {
		return nil, 0, detailFault(err)
	}
	p, err := process.NewProcessWithContext(ctx, pid)
	if err != nil {
		return nil, 0, detailFault(err)
	}
	created, err := p.CreateTimeWithContext(ctx)
	if err != nil {
		return nil, 0, detailFault(err)
	}
	if created <= 0 {
		return nil, 0, Failure("identity_unavailable", nil)
	}
	return p, created, nil
}

func checkDetailIdentity(ctx context.Context, pid int32, created int64) *Fault {
	_, actual, fault := openDetailProcess(ctx, pid)
	if fault == nil && actual != created {
		return Failure("identity_changed", nil)
	}
	return fault
}

func detailFault(err error) *Fault {
	if errors.Is(err, process.ErrorNotPermitted) {
		return Failure("permission_denied", err)
	}
	return Failure(Classify(err), err)
}
