import { useState } from 'react'
import ObservationForm from '../components/Track/ObservationForm'
import TrackHistory from '../components/Track/TrackHistory'
import type { Observation } from '../types'

export default function TrackPage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit')
  const [observations, setObservations] = useState<Observation[]>([])

  function handleNewObservation(obs: Observation) {
    setObservations((prev) => [obs, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Track</h2>
        <p className="text-sm text-surface-500 mt-1">
          Report plastic observations you see on campus
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('submit')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'submit'
              ? 'bg-white text-surface-800 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          Submit Observation
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-surface-800 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          My History
        </button>
      </div>

      {/* Content */}
      {activeTab === 'submit' ? (
        <div className="max-w-xl">
          <ObservationForm onSubmit={handleNewObservation} />
        </div>
      ) : (
        <div>
          {observations.length > 0 && (
            <p className="text-sm text-surface-500 mb-4">
              Your recent submissions:
            </p>
          )}
          <TrackHistory newObservations={observations} />
        </div>
      )}
    </div>
  )
}
