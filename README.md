# RockPaperScissors — On-Chain Commit–Reveal Game

**Contract address:** `0x16d05325000518f5b7bC7115B3f3825fcBaDF2dC`  
Explorer: https://coston2-explorer.flare.network/address/0x16d05325000518f5b7bC7115B3f3825fcBaDF2dC

---

## Project Description

This repository contains a lightweight, beginner-friendly Solidity implementation of **Rock–Paper–Scissors** using a commit–reveal pattern. The contract allows two players to play trustlessly on an EVM-compatible chain (deployed to Flare Coston2 testnet). Players first submit a cryptographic commitment of their move (a keccak256 hash of the move and a secret nonce), then later reveal their move and nonce so the contract can verify honesty and resolve the match.

The project is intended for learners and developers who want a simple, auditable example of:
- commit–reveal flows,
- event-driven smart contract interactions,
- multi-game state management on-chain.

---

## Description — What it does

- **Create a game**: One player creates a new match (no constructor or on-deploy configuration required).
- **Join a game**: A second player joins the open match.
- **Commit a move**: Both players submit the hash of `(move, nonce)` to avoid front-running and cheating.
- **Reveal a move**: After both commitments are in, players reveal the underlying move and nonce; the contract checks the commitment and records the revealed move.
- **Resolve winner**: Once both moves are revealed the contract resolves the outcome using classic RPS rules. Ties are handled as ties (no winner).
- **Claim timeout**: If a player refuses to reveal after the commit phase, the other player can call `claimTimeout` once the configured timeout elapses — preventing games from being indefinitely blocked.
- **Multi-game**: Each game has a unique `gameId` (incremental `nextGameId`), so many matches can run in parallel.

---

## Features

- **Commit–Reveal Security**: Prevents cheating by hiding moves until both players are committed.
- **No Deployment Parameters**: Deploys cleanly with no constructor inputs — great for demos and rapid testing.
- **Event Logs**: `GameCreated`, `Committed`, `Revealed`, `GameResolved`, and `ClaimTimeout` events make building a frontend or monitoring tool straightforward.
- **Timeout Mechanism**: Protects honest players from opponents who refuse to reveal.
- **Simple ABI**: The contract ABI is included and designed to work with viem/wagmi clients.
- **Beginner-Focused**: Code and UI are kept explicit and easy to follow for learning and extension.

---

## How It Solves The Problem

**Problem:** In open networks, players can cheat by observing on-chain actions and changing their own move after seeing an opponent's move. Additionally, games can get stuck if an opponent refuses to reveal their move after committing.

**Solution:**
- **Commit–Reveal**: Players first submit a cryptographic commitment (hash) of their move + nonce. Because the actual move is not on-chain during the commit phase, opponents cannot reactively change their move.
- **Reveal Phase**: After both players have committed, each reveals their original move and nonce. The contract verifies the reveal against the previously submitted hash.
- **Timeout Claim**: If an opponent refuses to reveal, a reveal timeout protects honest players by letting them claim the win after the timeout period. This keeps the system usable and prevents indefinite deadlocks.
- **Event-Driven UX**: Events give frontends and indexers clear hooks to build responsive UIs (show pending commits, reveal windows, resolved matches).

**Use Cases & Benefits**
- Educational demos for smart contract security patterns.
- Small on-chain games with optional later expansion to bets/stakes.
- A base for tournaments, leaderboards, and on-chain scorekeeping.
- Demonstrates important UX patterns (wallet gating, transaction lifecycle, optimistic UI) for dApp development.

---

## Technical Notes

- **Contract functions** you’ll interact with:
  - `createGame()` → creates a new game, returns `gameId`.
  - `joinGame(gameId)` → join an existing game as player B.
  - `commitMove(gameId, commitment)` → submit keccak256(move, nonce).
  - `revealMove(gameId, move, nonce)` → reveal real move & nonce.
  - `claimTimeout(gameId)` → claim win if opponent failed to reveal after timeout.
  - `computeCommitment(move, nonce)` → pure helper (on-chain) that computes the same hash used for commitments.
  - `games(gameId)` → view game state.
  - `nextGameId` and `REVEAL_TIMEOUT` are exposed as view values.

- **Frontend integration**: The included hook (`hooks/useContract.ts`) and sample UI (`components/sample.tsx`) show how to:
  - Create/join games.
  - Compute commitments.
  - Commit and reveal moves.
  - Claim timeouts and fetch game state.
  - Manage transaction lifecycle: pending → confirming → confirmed, and surface errors.

- **Security & improvements**:
  - The contract provided is a learning implementation. For real-money games or production, add careful fund escrow logic, withdrawal patterns (pull over push), reentrancy guards, and audit the contract.
  - Consider binding commitments to `msg.sender` (e.g., include player address in the commitment) to prevent cross-game replay if you add betting features.
  - Make the reveal timeout configurable per-game if desired.

---

## Quick Start (Dev)

1. Clone the repo.
2. Start a development environment with a wallet connected (Remix, Hardhat + local node, or a frontend connecting to Coston2).
3. Open the sample component and use the UI to create/join/commit/reveal.
4. Use the explorer link above to inspect transactions and contract state.

---

If you want, I can:
- Add a polished React frontend that stores nonces locally and walks users through the commit/reveal flow.
- Add stake/wager functions and a safe withdrawal pattern.
- Prepare a “verify on Routescan” payload if you want the contract source verified automatically.

---

# rockPaper2
# rockPaper2
