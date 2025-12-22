export function Issues() {
  const issues = [
    {
      id: 1,
      title: "Recurring Bug",
      description: "Payment error in checkout",
      icon: "🐛",
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      id: 2,
      title: "High Risk",
      description: "Unauthorized access attempts",
      icon: "🛡️",
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      id: 3,
      title: "Suggested Actions",
      description: "Increase monitoring on app C",
      icon: "📋",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xl font-medium text-gray-800">Recent Issues</h3>
      </div>
      <div className="space-y-3 p-3 max-h-75 overflow-y-auto scroll-bar">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div
                className={`${issue.bgColor} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}
              >
                <span className={`text-xl ${issue.iconColor}`}>
                  {issue.icon}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900">{issue.title}</h3>
                <p className="text-gray-600 mt-1">{issue.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
