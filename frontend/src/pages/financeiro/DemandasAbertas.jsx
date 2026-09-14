import DemandList from './DemandList';

const DemandasAbertas = () => (
  <DemandList
    statusFilter="ABERTA"
    title="Demandas em Aberto"
    subtitleMine="Suas demandas ainda não concluídas."
    subtitleAll="Todas as demandas em aberto — clique em Associar OC quando a ordem de compra for gerada no Senior."
  />
);

export default DemandasAbertas;
