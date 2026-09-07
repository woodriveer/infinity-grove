using System;
using System.Runtime.CompilerServices;
using UnityEngine.Networking;

namespace InfinityGrove.Service
{
    /// <summary>Lets backend HTTP calls use `await request.SendWebRequest()` instead of a coroutine (AD-10's REST+JSON client).</summary>
    public static class UnityWebRequestAwaiterExtensions
    {
        public static UnityWebRequestAwaiter GetAwaiter(this UnityWebRequestAsyncOperation operation) =>
            new UnityWebRequestAwaiter(operation);
    }

    public struct UnityWebRequestAwaiter : INotifyCompletion
    {
        private readonly UnityWebRequestAsyncOperation _operation;

        public UnityWebRequestAwaiter(UnityWebRequestAsyncOperation operation)
        {
            _operation = operation;
        }

        public bool IsCompleted => _operation.isDone;

        public void GetResult()
        {
        }

        public void OnCompleted(Action continuation)
        {
            _operation.completed += _ => continuation();
        }
    }
}
