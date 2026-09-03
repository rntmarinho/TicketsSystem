#!/usr/bin/env bash
# Teste do POST /gestao/suprimentos/sync na stack de teste. Uso: bash test_sync.sh <BASE> <TOKEN>
set -u
BASE=${1:-http://127.0.0.1:5001}; TOKEN=${2:?token}
OK=0; FAIL=0
pass(){ OK=$((OK+1)); echo "  PASS  $1"; }
fail(){ FAIL=$((FAIL+1)); echo "  FAIL  $1  -> $2"; }
check(){ if [ "$2" = "$3" ]; then pass "$1 ($3)"; else fail "$1" "esperado $2, veio $3 ${4:-}"; fi; }
post(){ CODE=$(curl -s -o /tmp/sy -w "%{http_code}" -X POST "$BASE/gestao/suprimentos/sync" -H "Content-Type: application/json" ${1:+-H "X-Sync-Token: $1"} -d "$2"); BODY=$(cat /tmp/sy); }
jget(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))" 2>/dev/null; }
row(){ # row <sol> <seq> <cancelada> <comprada> <naocotada_ativa> [cotacao]
  echo "{\"solicitacao\":\"$1\",\"seq_solicitacao\":\"$2\",\"transacao\":\"91401\",\"produto\":\"999\",\"descricao_complementar_produto\":\"Item de teste $1/$2\",\"centro_custo\":\"280\",\"descricao_centro_custo\":\"SVPM CT 072/2024\",\"qtde_solicitada\":\"2,5\",\"preco_sol\":\"9,1492\",\"data_solicitacao\":\"2026-09-03\",\"previsao\":\"2026-09-16\",\"cotacao\":\"${6:-0}\",\"situacao\":\"teste\",\"erp_cancelada\":$3,\"erp_comprada\":$4,\"erp_nao_cotada_ativa\":$5}"; }

echo "== segurança"
post "" '{"rows":[]}'; check "sem token" 403 "$CODE"
post "token-errado" '{"rows":[]}'; check "token errado" 403 "$CODE"
post "$TOKEN" '{"foo":1}'; check "payload sem rows" 400 "$CODE"

echo "== inserção / atualização"
post "$TOKEN" "{\"rows\":[$(row 900001 1 false false true),$(row 900002 1 false false false),{\"solicitacao\":\"\",\"seq_solicitacao\":\"1\"}]}"
check "primeira carga" 200 "$CODE" "$BODY"
[ "$(echo "$BODY" | jget "['inserted']")" = "1" ] && pass "não cotada ativa inserida" || fail "inserida" "$BODY"
[ "$(echo "$BODY" | jget "['skipped_not_tracked']")" = "1" ] && pass "cotada não acompanhada ignorada" || fail "ignorada" "$BODY"
[ "$(echo "$BODY" | jget "['errors_total']")" = "1" ] && pass "linha sem chave reportada" || fail "erro linha" "$BODY"
post "$TOKEN" "{\"rows\":[$(row 900001 1 false false true)]}"; [ "$(echo "$BODY" | jget "['updated']")" = "1" ] && [ "$(echo "$BODY" | jget "['inserted']")" = "0" ] && pass "reenvio = update, sem duplicar" || fail "idempotência" "$BODY"

echo "== linha existente de planilha (Fernanda, 2580/1) recebe cotação do ERP"
post "$TOKEN" "{\"rows\":[$(row 2580 1 false false false 6055)]}"; [ "$(echo "$BODY" | jget "['updated']")" = "1" ] && pass "2580/1 atualizada (dono diferente do robô)" || fail "2580" "$BODY"

echo "== status automático"
post "$TOKEN" "{\"rows\":[$(row 900001 1 false true true)]}"; [ "$(echo "$BODY" | jget "['status_auto']['COMPRADO']")" = "1" ] && pass "gerou pedido -> COMPRADO" || fail "comprado" "$BODY"
post "$TOKEN" "{\"rows\":[$(row 900001 1 false true true)]}"; [ "$(echo "$BODY" | jget "['status_auto']['COMPRADO']")" = "0" ] && pass "reenvio não duplica mudança de status" || fail "status repetido" "$BODY"
post "$TOKEN" "{\"rows\":[$(row 900001 1 true false false)]}"; [ "$(echo "$BODY" | jget "['status_auto']['CANCELADO']")" = "1" ] && pass "cancelada no ERP -> CANCELADO" || fail "cancelado" "$BODY"
post "$TOKEN" "{\"rows\":[$(row 900001 1 false true false)]}"; [ "$(echo "$BODY" | jget "['status_auto']['COMPRADO']")" = "0" ] && pass "CANCELADO não volta pra COMPRADO" || fail "cancelado fixo" "$BODY"
echo
echo "RESULTADO: $OK passaram, $FAIL falharam"; [ "$FAIL" = "0" ]
