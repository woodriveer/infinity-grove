using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Thin presentation root for the combat loop. Holds no gameplay state itself -
    /// it only kicks off ICombatService and lets KrellPresenter/MonsterPresenter
    /// react to the service's events independently.
    /// </summary>
    public class CombatPresenter : MonoBehaviour
    {
        private ICombatService _combatService;

        [Inject]
        public void Construct(ICombatService combatService)
        {
            _combatService = combatService;
        }

        private void Start()
        {
            _combatService.Begin();
        }
    }
}
