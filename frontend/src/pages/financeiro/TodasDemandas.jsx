import DemandList from './DemandList';

const TodasDemandas = () => (
  <DemandList
    statusFilter={null}
    title="Todas as Demandas"
    subtitleMine="Todas as suas demandas, de qualquer status."
    subtitleAll="Todas as demandas do Financeiro, de qualquer status."
  />
);

export default TodasDemandas;
