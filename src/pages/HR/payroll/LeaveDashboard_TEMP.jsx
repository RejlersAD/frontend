// Temporary patch file - add this button after line 1024 (after the VIEWS.map closing brace)
//
// INSERT AFTER:  })}
// AND BEFORE:    <div className="ml-auto flex...

        {/* Initialize Leave button (HR Manager only) */}
        {isHRManager && (
          <button 
            type="button" 
            onClick={initializeCurrentMonthLeave} 
            disabled={initBusy}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {initBusy ? (
              <Spinner />
            ) : (
              <HeroIcons.BanknotesIcon className="w-4 h-4" />
            )}
            Initialize Leave
          </button>
        )}

// ALSO CHANGE: <div className="ml-auto flex... to <div className={`${isHRManager ? '' : 'ml-auto'} flex...

// AND INSERT THIS MESSAGE DIV after the closing </div> of the View tabs section (before {view === 'overview'...):

      {/* Initialization message */}
      {initMsg && (
        <div className={`rounded-xl p-4 text-sm border ${
          initMsg.type === 'ok' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-start gap-2">
            {initMsg.type === 'ok' ? (
              <HeroIcons.CheckCircleIcon className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <HeroIcons.XCircleIcon className="w-5 h-5 flex-shrink-0 text-rose-600" />
            )}
            <div className="flex-1">
              <p className="font-medium">{initMsg.text}</p>
              <p className="text-xs mt-1 opacity-70">
                Monthly accrual: <strong>1.83 days</strong> (22 days/year ÷ 12 months)
              </p>
            </div>
            <button 
              type="button" 
              onClick={() => setInitMsg(null)}
              className="text-slate-400 hover:text-slate-600">
              <HeroIcons.XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
