/**
 * Gantt simples: barras posicionadas por CSS sobre uma linha de dias, ordem
 * WBS pela hierarquia de subtarefas. Não recalcula caminho crítico no
 * navegador — usa start_date/due_date já persistidos (o backend já reagenda
 * em cascata quando duração/dependência muda, ver services/reschedule.py).
 */
const DAY_WIDTH = 26;

function buildWbsRows(tasks) {
  const idSet = new Set(tasks.map((t) => t.id));
  const byParent = new Map();
  for (const t of tasks) {
    const key = t.parent_task_id && idSet.has(t.parent_task_id) ? t.parent_task_id : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  }
  const rows = [];
  function walk(parentId, depth) {
    for (const t of byParent.get(parentId) || []) {
      rows.push({ task: t, depth });
      walk(t.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

const GestaoGanttView = ({ tasks }) => {
  const dated = tasks.filter((t) => t.start_date && t.due_date);
  if (dated.length === 0) {
    return <p className="gestao-empty">Nenhuma tarefa com início e prazo definidos ainda.</p>;
  }

  const rows = buildWbsRows(tasks);
  const starts = dated.map((t) => new Date(t.start_date).getTime());
  const epoch = new Date(Math.min(...starts));

  const dayOffset = (iso) => Math.round((new Date(iso).getTime() - epoch.getTime()) / 86400000);

  return (
    <div className="gestao-gantt-wrap">
      {rows.map(({ task, depth }) => {
        const hasDates = task.start_date && task.due_date;
        const left = hasDates ? dayOffset(task.start_date) * DAY_WIDTH : 0;
        const width = hasDates
          ? Math.max(DAY_WIDTH, (dayOffset(task.due_date) - dayOffset(task.start_date)) * DAY_WIDTH)
          : 0;
        return (
          <div key={task.id} className="gestao-gantt-row">
            <div className="gestao-gantt-label" style={{ paddingLeft: 4 + depth * 16 }}>{task.title}</div>
            <div className="gestao-gantt-timeline" style={{ minWidth: 600 }}>
              {hasDates && (
                <div
                  className="gestao-gantt-bar"
                  style={{ left, width }}
                  title={`${new Date(task.start_date).toLocaleDateString('pt-BR')} — ${new Date(task.due_date).toLocaleDateString('pt-BR')}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GestaoGanttView;
