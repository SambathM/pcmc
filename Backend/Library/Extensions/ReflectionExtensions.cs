using System.Linq.Expressions;

namespace Library.Extensions
{
    internal static class ExpressionHelper
    {
        public static object? LambdaValueAccessor(this Expression exp)
        {
            return exp switch
            {
                UnaryExpression unary when unary.NodeType == ExpressionType.Convert || unary.NodeType == ExpressionType.ConvertChecked =>
                    LambdaValueAccessor(unary.Operand),

                ConstantExpression constant => constant.Value,

                MemberExpression member => GetMemberValue(member),

                NewExpression newExp => GetNewExpressionValue(newExp),

                ListInitExpression listInit => GetListInitValue(listInit),

                MethodCallExpression methodCall => GetMethodCallValue(methodCall),

                _ => throw new NotSupportedException($"Unsupported expression type: {exp.NodeType}")
            };
        }

        private static object? GetMemberValue(MemberExpression member)
        {
            ArgumentNullException.ThrowIfNull(member);

            var objectMember = Expression.Convert(member, typeof(object));
            var getterLambda = Expression.Lambda<Func<object?>>(objectMember);
            return getterLambda.Compile().Invoke();
        }

        private static object GetNewExpressionValue(NewExpression newExp)
        {
            var args = newExp.Arguments.Select(a => a.LambdaValueAccessor()).ToArray();
            return newExp.Constructor?.Invoke(args)
                ?? throw new InvalidOperationException("Expression has no constructor.");
        }

        private static object GetListInitValue(ListInitExpression listInit)
        {
            var newList = GetNewExpressionValue(listInit.NewExpression);
            foreach (var initializer in listInit.Initializers)
            {
                var values = initializer.Arguments.Select(a => a.LambdaValueAccessor()).ToArray();
                initializer.AddMethod.Invoke(newList, values);
            }
            return newList;
        }

        private static object? GetMethodCallValue(MethodCallExpression methodCall)
        {
            var instance = methodCall.Object?.LambdaValueAccessor();
            var args = methodCall.Arguments.Select(a => a.LambdaValueAccessor()).ToArray();
            return methodCall.Method.Invoke(instance, args);
        }

    }

}
