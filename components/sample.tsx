// components/sample.tsx
"use client"

import { useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { isAddress } from "viem"
import { useRPSContract } from "@/hooks/useContract"
import { contractABI, contractAddress } from "@/lib/contract"

const moveLabels = ["Rock", "Paper", "Scissors"]

const SampleIntregation = () => {
  const { isConnected, address } = useAccount()
  const [selectedGameId, setSelectedGameId] = useState("")
  const [joinGameId, setJoinGameId] = useState("")
  const [move, setMove] = useState<number>(0)
  const [nonce, setNonce] = useState("")
  const [computedCommitment, setComputedCommitment] = useState<string>("")
  const [fetchGameId, setFetchGameId] = useState("")
  const [computeEnabled, setComputeEnabled] = useState(false)

  const { data, actions, state, refetchGameById } = useRPSContract()

  // computeCommitment read hook - enabled only when computeEnabled is true and inputs present
  const { data: commitmentData, refetch: refetchCommitment } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "computeCommitment",
    args: [move, nonce],
    enabled: false,
  })

  const handleCreateGame = async () => {
    try {
      await actions.createGame()
    } catch (err) {
      console.error("Error creating game:", err)
    }
  }

  const handleJoinGame = async () => {
    const id = Number(joinGameId || 0)
    if (!id || id <= 0) return
    try {
      await actions.joinGame(id)
      setJoinGameId("")
    } catch (err) {
      console.error("Error joining game:", err)
    }
  }

  const handleComputeCommitment = async () => {
    if (!nonce) return
    try {
      setComputeEnabled(true)
      await refetchCommitment({
        address: contractAddress,
        abi: contractABI,
        functionName: "computeCommitment",
        args: [move, nonce],
      } as any)
      if (commitmentData) {
        setComputedCommitment(String(commitmentData))
      } else {
        // fetch again to pick up result
        // wagmi will populate commitmentData; but to be safe, set from returned value if available
        // fallback: call refetchCommitment and read result above
      }
    } catch (err) {
      console.error("Error computing commitment:", err)
    } finally {
      setComputeEnabled(false)
    }
  }

  // Since refetchCommitment is async and commitmentData may update after re-render,
  // watch for commitmentData changes and update computedCommitment.
  // (Simple listener - not using useEffect to keep this file straightforward)
  if (commitmentData && !computedCommitment) {
    setComputedCommitment(String(commitmentData))
  }

  const handleCommitMove = async () => {
    const id = Number(selectedGameId || 0)
    if (!id || !computedCommitment) return
    try {
      await actions.commitMove(id, computedCommitment)
      // clear commitment only on success
      setComputedCommitment("")
    } catch (err) {
      console.error("Error committing move:", err)
    }
  }

  const handleReveal = async () => {
    const id = Number(selectedGameId || 0)
    if (!id || nonce === "") return
    try {
      await actions.revealMove(id, move, nonce)
      setNonce("")
    } catch (err) {
      console.error("Error revealing move:", err)
    }
  }

  const handleClaimTimeout = async () => {
    const id = Number(selectedGameId || 0)
    if (!id) return
    try {
      await actions.claimTimeout(id)
    } catch (err) {
      console.error("Error claiming timeout:", err)
    }
  }

  const handleFetchGame = async () => {
    const id = Number(fetchGameId || 0)
    if (!id) return
    try {
      await refetchGameById(id)
      // components will read contract.state.data.game via hook's returned data when populated
    } catch (err) {
      console.error("Error fetching game:", err)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <h2 className="text-2xl font-bold text-foreground mb-3">RockPaperScissors</h2>
          <p className="text-muted-foreground">Please connect your wallet to interact with the contract.</p>
        </div>
      </div>
    )
  }

  const canCompute = nonce.length > 0
  const canCommit = Number(selectedGameId) > 0 && computedCommitment
  const canReveal = Number(selectedGameId) > 0 && nonce.length > 0

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">RockPaperScissors</h1>
          <p className="text-muted-foreground text-sm mt-1">On-chain commit–reveal RPS. Contract: <a className="underline" href="https://coston2-explorer.flare.network/address/0x16d05325000518f5b7bC7115B3f3825fcBaDF2dC" target="_blank" rel="noreferrer">View on Coston2</a></p>
        </div>

        {/* Contract Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Next Game ID</p>
            <p className="text-2xl font-semibold text-foreground">{data.nextGameId}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Reveal Timeout (seconds)</p>
            <p className="text-2xl font-semibold text-foreground">{data.revealTimeout}</p>
          </div>
        </div>

        {/* Create / Join */}
        <div className="space-y-4 mb-6">
          <button
            onClick={handleCreateGame}
            disabled={state.isLoading || state.isPending}
            className="w-full px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {state.isLoading || state.isPending ? "Creating..." : "Create New Game"}
          </button>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Game ID to join"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none"
            />
            <button
              onClick={handleJoinGame}
              disabled={state.isLoading || state.isPending || Number(joinGameId) <= 0}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium disabled:opacity-50"
            >
              Join Game
            </button>
          </div>
        </div>

        {/* Commit & Reveal */}
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-foreground mb-1">Select Game ID to play</label>
          <input
            type="number"
            placeholder="Game ID"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
            className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Move</label>
              <select
                value={move}
                onChange={(e) => setMove(Number(e.target.value))}
                className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground"
              >
                <option value={0}>0 — Rock</option>
                <option value={1}>1 — Paper</option>
                <option value={2}>2 — Scissors</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nonce (secret)</label>
              <input
                type="text"
                placeholder="random secret"
                value={nonce}
                onChange={(e) => {
                  setNonce(e.target.value)
                  setComputedCommitment("")
                }}
                className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleComputeCommitment}
              disabled={!canCompute}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
            >
              Compute Commitment
            </button>
            <button
              onClick={handleCommitMove}
              disabled={!canCommit || state.isLoading || state.isPending}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium disabled:opacity-50"
            >
              {state.isLoading || state.isPending ? "Committing..." : "Commit Move"}
            </button>
          </div>

          {computedCommitment && (
            <div className="p-3 bg-card border border-border rounded-lg">
              <p className="text-xs text-muted-foreground">Commitment (submit on-chain)</p>
              <p className="text-sm font-mono break-all">{computedCommitment}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleReveal}
              disabled={!canReveal || state.isLoading || state.isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {state.isLoading || state.isPending ? "Revealing..." : "Reveal Move"}
            </button>
            <button
              onClick={handleClaimTimeout}
              disabled={!selectedGameId || state.isLoading || state.isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium disabled:opacity-50"
            >
              Claim Timeout
            </button>
          </div>
        </div>

        {/* Fetch Game */}
        <div className="mb-6 space-y-3">
          <label className="block text-sm font-medium text-foreground mb-1">Fetch Game By ID</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Game ID"
              value={fetchGameId}
              onChange={(e) => setFetchGameId(e.target.value)}
              className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-foreground"
            />
            <button
              onClick={handleFetchGame}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              Fetch
            </button>
          </div>

          {data.game && (
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Game #{fetchGameId}</p>
              <p className="text-sm">Player A: <span className="font-mono">{data.game.playerA}</span></p>
              <p className="text-sm">Player B: <span className="font-mono">{data.game.playerB}</span></p>
              <p className="text-sm">Revealed A: {String(data.game.revealedA)}</p>
              <p className="text-sm">Revealed B: {String(data.game.revealedB)}</p>
              <p className="text-sm">Stage: {data.game.stage}</p>
              <p className="text-sm">Move A: {data.game.revealedA ? moveLabels[data.game.moveA] ?? data.game.moveA : "Hidden"}</p>
              <p className="text-sm">Move B: {data.game.revealedB ? moveLabels[data.game.moveB] ?? data.game.moveB : "Hidden"}</p>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {state.hash && (
          <div className="mt-4 p-4 bg-card border border-border rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Transaction Hash</p>
            <p className="text-sm font-mono text-foreground break-all mb-3">{state.hash}</p>
            {state.isConfirming && <p className="text-sm text-primary">Waiting for confirmation...</p>}
            {state.isConfirmed && <p className="text-sm text-green-500">Transaction confirmed!</p>}
          </div>
        )}

        {state.error && (
          <div className="mt-4 p-4 bg-card border border-destructive rounded-lg">
            <p className="text-sm text-destructive-foreground">Error: {state.error.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SampleIntregation