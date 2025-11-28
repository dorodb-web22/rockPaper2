// hooks/useContract.ts
"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { contractABI, contractAddress } from "@/lib/contract"
import { formatEther } from "viem"

export interface GameData {
  playerA: `0x${string}` | string
  playerB: `0x${string}` | string
  commitA: string
  commitB: string
  moveA: number
  moveB: number
  revealedA: boolean
  revealedB: boolean
  stage: number
  commitTime: bigint
}

export interface ContractData {
  nextGameId: number
  revealTimeout: number
  game?: GameData
}

export interface ContractState {
  isLoading: boolean
  isPending: boolean
  isConfirming: boolean
  isConfirmed: boolean
  hash: `0x${string}` | undefined
  error: Error | null
}

export interface ContractActions {
  createGame: () => Promise<void>
  joinGame: (gameId: number) => Promise<void>
  commitMove: (gameId: number, commitment: string) => Promise<void>
  revealMove: (gameId: number, move: number, nonce: string) => Promise<void>
  claimTimeout: (gameId: number) => Promise<void>
}

export const useRPSContract = () => {
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [fetchedGame, setFetchedGame] = useState<GameData | undefined>()

  // read nextGameId
  const { data: nextGameIdData, refetch: refetchNextGameId } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "nextGameId",
  })

  const { data: revealTimeoutData, refetch: refetchRevealTimeout } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "REVEAL_TIMEOUT",
  })

  // helper to read a game by id (caller will use refetchGame)
  const { data: gameRaw, refetch: refetchGame } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "games",
    // args will be provided when calling refetchGame explicitly
    args: [(0 as unknown) as number],
    enabled: false,
  })

  // write hook
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isConfirmed) {
      refetchNextGameId()
      refetchRevealTimeout()
      // refetch game if we have one loaded
      if (fetchedGame) {
        // no direct way to know id, caller should request refetchGame externally
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed])

  // When refetchGame is called, wagmi will populate gameRaw; reflect it into fetchedGame
  useEffect(() => {
    if (!gameRaw) return
    try {
      // gameRaw is returned as a tuple-like object; map to GameData
      const g = gameRaw as any
      const mapped: GameData = {
        playerA: (g[0] as `0x${string}`) || "",
        playerB: (g[1] as `0x${string}`) || "",
        commitA: g[2] ? String(g[2]) : "",
        commitB: g[3] ? String(g[3]) : "",
        moveA: typeof g[4] === "bigint" ? Number(g[4]) : Number(g[4] ?? 0),
        moveB: typeof g[5] === "bigint" ? Number(g[5]) : Number(g[5] ?? 0),
        revealedA: Boolean(g[6]),
        revealedB: Boolean(g[7]),
        stage: typeof g[8] === "bigint" ? Number(g[8]) : Number(g[8] ?? 0),
        commitTime: g[9] ?? BigInt(0),
      }
      setFetchedGame(mapped)
    } catch (e) {
      console.error("Failed to map game data", e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRaw])

  const createGame = async () => {
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: contractAddress,
        abi: contractABI,
        functionName: "createGame",
      })
    } catch (err) {
      console.error("Error createGame:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const joinGame = async (gameId: number) => {
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: contractAddress,
        abi: contractABI,
        functionName: "joinGame",
        args: [BigInt(gameId)],
      })
    } catch (err) {
      console.error("Error joinGame:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const commitMove = async (gameId: number, commitment: string) => {
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: contractAddress,
        abi: contractABI,
        functionName: "commitMove",
        args: [BigInt(gameId), commitment as `0x${string}`],
      })
    } catch (err) {
      console.error("Error commitMove:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const revealMove = async (gameId: number, move: number, nonce: string) => {
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: contractAddress,
        abi: contractABI,
        functionName: "revealMove",
        args: [BigInt(gameId), move, nonce],
      })
    } catch (err) {
      console.error("Error revealMove:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const claimTimeout = async (gameId: number) => {
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: contractAddress,
        abi: contractABI,
        functionName: "claimTimeout",
        args: [BigInt(gameId)],
      })
    } catch (err) {
      console.error("Error claimTimeout:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const refetchGameById = async (gameId: number) => {
    try {
      // call the read contract with the specific arg
      await refetchGame({
        address: contractAddress,
        abi: contractABI,
        functionName: "games",
        args: [BigInt(gameId)],
      } as any)
    } catch (err) {
      console.error("Error fetching game:", err)
      throw err
    }
  }

  const data: ContractData = {
    nextGameId: nextGameIdData ? Number(nextGameIdData as bigint) : 1,
    revealTimeout: revealTimeoutData ? Number(revealTimeoutData as bigint) : 0,
    game: fetchedGame,
  }

  const actions: ContractActions = {
    createGame,
    joinGame,
    commitMove,
    revealMove,
    claimTimeout,
  }

  const state: ContractState = {
    isLoading: isLoading || isPending || isConfirming,
    isPending,
    isConfirming,
    isConfirmed,
    hash,
    error,
  }

  return {
    data,
    actions,
    state,
    refetchGameById,
    refetchNextGameId,
    refetchRevealTimeout,
  }
}